import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ShelfBook } from "../components";
import {
  bindingDepth,
  displayTitle,
  jacketFor,
  smallShelfCover,
} from "../../../shared/artwork";
import { useRailDrag } from "./useRailDrag";
import { BoundVolume } from "./BoundVolume";
import { warmNote } from "../../../shared/bookNote";

const gutter = 3;
const pad = 130;

// Start at the first binding whose right edge is beyond this position.
function firstAt(ends: number[], x: number) {
  let lo = 0,
    hi = ends.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ends[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function PocketShelf({
  books,
  covers,
  open,
}: {
  books: ShelfBook[];
  covers: boolean;
  open: (id: string) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  useRailDrag(rail);
  const track = useRef<HTMLDivElement>(null);
  const [turned, setTurned] = useState<string | null>(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const zoom = Math.max(1.5, Math.min(2.12, (height - 48) / 188));
  const [view, setView] = useState({ band: 0, active: 0 });
  const lastView = useRef(view);
  const frame = useRef(0);
  const anchor = useRef(0);
  const requestCenter = useRef<number | null>(0);

  const layout = useMemo(() => {
    let length = 0;
    const ends = books.map((book) => {
      const size =
        covers || book.id === turned
          ? Math.ceil(112 * zoom + 8)
          : Math.max(30, Math.round(bindingDepth(book) * zoom));
      length += size + gutter;
      return length;
    });
    const loop = books.length > 1 && length > width + 2 * pad;
    return {
      ends,
      length,
      loop,
      inset: loop ? 0 : width / 2,
      copies: loop ? 3 : 1,
    };
  }, [books, covers, turned, width, zoom]);
  const { ends, length, loop, inset, copies } = layout;
  const start = (i: number) => (i === 0 ? 0 : ends[i - 1]);
  const center = (i: number) => (start(i) + ends[i] - gutter) / 2;
  const { active, band } = view;
  const position = band * pad;
  const current = books[active];
  const syncView = useCallback(
    (scroll: number) => {
      const eye = scroll + width / 2;
      track.current?.style.setProperty("--pocket-eye", String(eye));
      const local = Math.max(0, eye - inset);
      const active = firstAt(ends, loop ? local % length : local);
      const band = Math.floor(scroll / pad);
      if (active === lastView.current.active && band === lastView.current.band)
        return;
      lastView.current = { active, band };
      setView(lastView.current);
    },
    [width, inset, ends, loop, length],
  );

  // Warm one jacket when the reader pauses on a spine. The same responsive
  // asset is reused on tap. Give the spines first use of the connection.
  useEffect(() => {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (covers || turned === current.id || connection?.saveData) return;
    const jacket = jacketFor(current);
    if (!jacket) return;
    let preview: HTMLImageElement;
    const timer = window.setTimeout(() => {
      if (document.hidden) return;
      preview = new Image();
      preview.fetchPriority = "low";
      preview.src =
        jacket.small && matchMedia(smallShelfCover).matches
          ? jacket.small
          : jacket.file;
      void preview.decode().catch(() => {});
    }, 160);
    return () => clearTimeout(timer);
  }, [covers, current, turned]);

  useLayoutEffect(() => {
    const el = rail.current!;
    let measuredWidth = 0,
      measuredHeight = 0;
    const measure = () => {
      const width = el.clientWidth,
        height = el.clientHeight;
      if (measuredWidth === width && measuredHeight === height) return;
      if (measuredWidth && requestCenter.current === null)
        requestCenter.current = anchor.current;
      measuredWidth = width;
      measuredHeight = height;
      setSize({ width, height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  useLayoutEffect(() => {
    const el = rail.current!;
    const i = requestCenter.current;
    if (!width || i === null) return;
    requestCenter.current = null;
    el.scrollLeft = inset + (loop ? length : 0) + center(i) - width / 2;
    syncView(el.scrollLeft);
  }, [layout, syncView]);

  // Move to the identical middle copy after momentum stops. No finger
  // tracking or synthetic inertia on touch devices.
  useEffect(() => {
    const el = rail.current!;
    let timer = 0;
    let touching = false;
    function settle() {
      if (!loop || touching) return;
      // Jumping copies would unmount a keyboard-focused book button and drop
      // focus to the page. Wait until it leaves. A tap also focuses the
      // button on some phones, but not visibly, so it must not hold the loop.
      const focused = document.activeElement;
      if (
        focused !== el &&
        el.contains(focused) &&
        focused?.matches(":focus-visible")
      )
        return;
      const copy = Math.floor((el.scrollLeft + width / 2) / length);
      if (copy !== 1) {
        el.scrollLeft += (1 - copy) * length;
        syncView(el.scrollLeft);
      }
    }
    function scrolled() {
      if (!frame.current)
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          syncView(el.scrollLeft);
        });
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 160);
    }
    const touchStart = () => {
      touching = true;
    };
    const touchEnd = () => {
      touching = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 160);
    };
    el.addEventListener("scroll", scrolled, { passive: true });
    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchend", touchEnd, { passive: true });
    el.addEventListener("touchcancel", touchEnd, { passive: true });
    el.addEventListener("focusout", touchEnd);
    return () => {
      el.removeEventListener("scroll", scrolled);
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchend", touchEnd);
      el.removeEventListener("touchcancel", touchEnd);
      el.removeEventListener("focusout", touchEnd);
      window.clearTimeout(timer);
    };
  }, [length, loop, width, syncView]);
  useLayoutEffect(() => {
    anchor.current = active;
  }, [active]);

  function move(direction: number) {
    const el = rail.current!;
    const local = Math.max(0, el.scrollLeft + width / 2 - inset);
    const index = firstAt(ends, loop ? local % length : local) + direction;
    if (!loop && (index < 0 || index >= books.length)) return;
    const next = (index + books.length) % books.length;
    const copy = loop
      ? Math.floor(local / length) + Math.floor(index / books.length)
      : 0;
    el.scrollTo({
      left: inset + copy * length + center(next) - width / 2,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  const slots = [];
  for (let copy = 0; width > 0 && copy < copies; copy++) {
    const base = inset + copy * length;
    if (base > position + width + 2 * pad || base + length < position - pad)
      continue;
    const first = firstAt(ends, position - pad - base);
    for (
      let i = first;
      i < books.length && base + start(i) < position + width + 2 * pad;
      i++
    ) {
      const book = books[i],
        title = displayTitle(book.title);
      const face = covers || book.id === turned;
      const left = base + start(i);
      slots.push(
        <div
          key={copy + ":" + book.id}
          className={"pocket-slot" + (face ? " face-out" : "")}
          data-book={book.id}
          style={
            {
              left,
              width: ends[i] - start(i) - gutter,
              "--slot-left": left,
              "--slot-center": base + center(i),
            } as CSSProperties
          }
        >
          <button
            className="volume-pick"
            aria-label={
              (face ? "Open details for " : "Turn to cover of ") +
              title +
              " by " +
              book.author
            }
            onClick={() => {
              if (face) open(book.id);
              else {
                warmNote(book.id);
                requestCenter.current = i;
                setTurned(book.id);
              }
            }}
          >
            <span className="pocket-scale">
              <BoundVolume
                book={book}
                showJacket={face}
                preview={!covers && face}
              />
            </span>
          </button>
          {!covers && turned === book.id && (
            <button
              className="pocket-return"
              aria-label={"Reshelve " + title}
              onClick={() => {
                requestCenter.current = i;
                setTurned(null);
              }}
            >
              Reshelve
            </button>
          )}
        </div>,
      );
    }
  }
  return (
    <>
      <div className="pocket-case cabinet" id="bookcase">
        <div className="cornice" />
        <div className="bay walnut-bay">
          <div className="bay-floor" />
          <div
            className="pocket-rail"
            ref={rail}
            tabIndex={0}
            role="region"
            aria-label="Swipe through the bookshelf"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                move(e.key === "ArrowLeft" ? -1 : 1);
              }
            }}
          >
            <div
              className="pocket-track"
              ref={track}
              style={
                {
                  width: inset * 2 + length * copies,
                  "--pocket-zoom": zoom,
                } as CSSProperties
              }
            >
              {slots}
            </div>
          </div>
        </div>
        <div className="shelf-lip">
          <span className="brass-plate">
            {String(active + 1).padStart(3, "0")} /{" "}
            {String(books.length).padStart(3, "0")}
          </span>
        </div>
        <div className="pocket-lamp" aria-hidden="true" />
      </div>
      <div className="pocket-caption">
        <div className="pocket-current">
          <small>{current.focus}</small>
          <button className="pocket-title" onClick={() => open(current.id)}>
            {displayTitle(current.title)}
            <ArrowUpRight size={17} />
          </button>
          <p>{current.author}</p>
        </div>
        <div className="pocket-steps">
          <button
            aria-label="Previous book on shelf"
            disabled={!loop && active === 0}
            onClick={() => move(-1)}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            aria-label="Next book on shelf"
            disabled={!loop && active === books.length - 1}
            onClick={() => move(1)}
          >
            <ArrowRight size={18} />
          </button>
          {books.length > 1 && (
            <small className="pocket-swipe-hint">
              or swipe with your fingers
            </small>
          )}
        </div>
      </div>
    </>
  );
}
