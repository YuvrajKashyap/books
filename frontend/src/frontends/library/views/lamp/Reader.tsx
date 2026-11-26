// The reader: the chosen book leaves its shelf, turns in the lamplight above
// a desk, and its notes lie beneath it on a card.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useNote,
  type BookArt,
  type ShelfBook,
} from "../../../../shared/catalogue";
import type { Lamp } from "./lamp";
import type { Layout } from "./Bookcase";
import { PULLED_TURN } from "./Pull";

const REST_Y = 24;
const REST_X = -5;

type Spin = {
  rx: number;
  ry: number;
  vx: number;
  vy: number;
  tRy: number | null;
  tRx: number;
  drag: boolean;
  moved: number;
  px: number;
  py: number;
  pt: number;
  pid: number;
  raf: number;
  last: number;
};

export function Reader({
  book,
  art,
  place,
  total,
  closing,
  fly,
  layout,
  reduced,
  origin,
  lampRef,
  onClose,
  onClosed,
  onStep,
}: {
  book: ShelfBook;
  art: BookArt;
  place: number; // 1-based position in the current order
  total: number;
  closing: boolean;
  fly: boolean; // arrive from the shelf rather than out of the dark
  layout: Layout;
  reduced: boolean;
  // Where the book is on the page, and whether its cover already faces out.
  origin: (id: string) => { rect: DOMRect; facing: boolean } | null;
  lampRef: RefObject<Lamp | null>;
  onClose: () => void;
  onClosed: () => void;
  onStep: (dir: 1 | -1) => void;
}) {
  const { note, state, retry } = useNote(book.id);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [aspect, setAspect] = useState(0.665);
  const [size, setSize] = useState(() => bookHeight());
  const dialog = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const flyEl = useRef<HTMLDivElement>(null);
  const bookEl = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const spin = useRef<Spin>({
    rx: REST_X,
    ry: REST_Y,
    vx: 0,
    vy: 0,
    tRy: REST_Y,
    tRx: REST_X,
    drag: false,
    moved: 0,
    px: 0,
    py: 0,
    pt: 0,
    pid: -1,
    raf: 0,
    last: 0,
  }).current;
  const firstId = useRef(book.id);

  const H = size;
  const W = Math.round(H * aspect);
  const D = Math.max(12, Math.round((art.depth * H) / 190));

  function paint() {
    const el = bookEl.current;
    if (!el) return;
    el.style.transform = `rotateX(${spin.rx.toFixed(2)}deg) rotateY(${spin.ry.toFixed(2)}deg)`;
    const turn = ((((spin.ry + 180) % 360) + 360) % 360) - 180;
    el.style.setProperty(
      "--sheen",
      Math.max(-130, Math.min(130, -turn * 2.4)).toFixed(1),
    );
  }
  function tick(now: number) {
    spin.raf = 0;
    const dt = spin.last ? Math.min((now - spin.last) / 1000, 1 / 30) : 1 / 60;
    spin.last = now;
    if (!spin.drag) {
      if (spin.tRy !== null)
        spin.vy += (22 * (spin.tRy - spin.ry) - 7.2 * spin.vy) * dt;
      else spin.vy *= Math.exp(-2.4 * dt);
      spin.vx += (34 * (spin.tRx - spin.rx) - 9 * spin.vx) * dt;
      spin.ry += spin.vy * dt;
      spin.rx += spin.vx * dt;
      paint();
      const still =
        Math.abs(spin.vy) < 0.6 &&
        Math.abs(spin.vx) < 0.6 &&
        (spin.tRy === null || Math.abs(spin.tRy - spin.ry) < 0.08) &&
        Math.abs(spin.tRx - spin.rx) < 0.08;
      if (still) {
        spin.last = 0;
        return;
      }
    }
    spin.raf = requestAnimationFrame(tick);
  }
  function run() {
    if (reduced) {
      if (spin.tRy !== null) spin.ry = spin.tRy;
      spin.rx = spin.tRx;
      spin.vx = spin.vy = 0;
      paint();
      return;
    }
    if (!spin.raf) {
      spin.last = 0;
      spin.raf = requestAnimationFrame(tick);
    }
  }

  // Arrival: straight off the shelf when the shelf copy is in view.
  useLayoutEffect(() => {
    const el = flyEl.current;
    if (!el) return;
    const found = origin(book.id);
    const from = fly && !reduced && found ? found.rect : null;
    if (from) {
      const box = el.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (box.left + box.width / 2);
      const dy = from.top + from.height / 2 - (box.top + box.height / 2);
      const s = from.height / box.height;
      spin.ry = found?.facing ? PULLED_TURN : layout === "spines" ? 90 : 0;
      spin.rx = 0;
      el.animate(
        [
          { transform: `translate3d(${dx}px,${dy}px,0) scale(${s})` },
          {
            transform: `translate3d(${dx * 0.55}px,${dy * 0.5 - 26}px,0) scale(${s + (1 - s) * 0.55})`,
            offset: 0.42,
          },
          { transform: "translate3d(0,0,0) scale(1)" },
        ],
        {
          duration: 920,
          easing: "cubic-bezier(.3,.1,.2,1)",
          fill: "backwards",
        },
      );
    } else if (!reduced) {
      spin.ry = REST_Y + 50;
      el.animate(
        [
          { transform: "translate3d(0,46px,0) scale(.9)", opacity: 0 },
          { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
        ],
        { duration: 620, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
    spin.tRy = REST_Y;
    paint();
    run();
    dialog.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(spin.raf);
      spin.raf = 0;
    };
    // Arrival happens once, when the reader mounts.
  }, []);

  // Stepping to another book: close the cover and let the new one swing in.
  useEffect(() => {
    if (firstId.current === book.id) return;
    firstId.current = book.id;
    setOpen(false);
    setMore(false);
    spin.ry = REST_Y - 46;
    spin.vy = 0;
    spin.tRy = REST_Y;
    run();
    dialog.current?.scrollTo({ top: 0 });
  }, [book.id]);

  // Leaving: back to the gap it left.
  useEffect(() => {
    if (!closing) return;
    setOpen(false);
    const el = flyEl.current;
    const to = el && !reduced ? (origin(book.id)?.rect ?? null) : null;
    let wait = reduced ? 120 : 340;
    let flight: Animation | undefined;
    if (el && to) {
      const box = el.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (box.left + box.width / 2);
      const dy = to.top + to.height / 2 - (box.top + box.height / 2);
      const s = to.height / box.height;
      const want = layout === "spines" ? 90 : 0;
      spin.ry = ((((spin.ry + 180) % 360) + 360) % 360) - 180;
      spin.tRy = want;
      spin.tRx = 0;
      spin.vy = 0;
      run();
      flight = el.animate(
        [
          { transform: "translate3d(0,0,0) scale(1)" },
          { transform: `translate3d(${dx}px,${dy}px,0) scale(${s})` },
        ],
        { duration: 620, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" },
      );
      wait = 640;
    }
    const t = window.setTimeout(onClosed, wait);
    return () => {
      window.clearTimeout(t);
      // Reopened before it landed: let go of the flight and stand it up again.
      flight?.cancel();
      spin.tRy = REST_Y;
      spin.tRx = REST_X;
    };
  }, [closing]);

  useEffect(() => {
    const lamp = lampRef.current;
    if (!lamp || !glow.current || !shadow.current || !stage.current) return;
    lamp.setReader({
      glow: glow.current,
      shadow: shadow.current,
      stage: stage.current,
    });
    return () => lamp.setReader(null);
  }, [lampRef]);

  useEffect(() => {
    const fit = () => setSize(bookHeight());
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    if (closing) return;
    spin.tRy = open ? 4 : spin.tRy === null ? null : REST_Y;
    if (open) spin.tRx = -2;
    else spin.tRx = REST_X;
    run();
  }, [open]);

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    spin.drag = true;
    spin.pid = e.pointerId;
    spin.moved = 0;
    spin.px = e.clientX;
    spin.py = e.clientY;
    spin.pt = e.timeStamp;
    spin.vx = spin.vy = 0;
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!spin.drag || spin.pid !== e.pointerId) return;
    const dx = e.clientX - spin.px;
    const dy = e.clientY - spin.py;
    const dt = Math.max(8, e.timeStamp - spin.pt) / 1000;
    spin.px = e.clientX;
    spin.py = e.clientY;
    spin.pt = e.timeStamp;
    spin.moved += Math.abs(dx) + Math.abs(dy);
    if (spin.moved < 6) return;
    spin.tRy = null;
    spin.ry += dx * 0.5;
    spin.rx = Math.max(-62, Math.min(62, spin.rx - dy * 0.36));
    spin.vy = spin.vy * 0.6 + ((dx * 0.5) / dt) * 0.4;
    paint();
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (!spin.drag || spin.pid !== e.pointerId) return;
    spin.drag = false;
    spin.pid = -1;
    if (spin.moved < 6) {
      setOpen((o) => !o);
      return;
    }
    if (e.timeStamp - spin.pt > 90) spin.vy = 0;
    spin.vy = Math.max(-1100, Math.min(1100, spin.vy));
    spin.vx = 0;
    run();
  }
  function bookKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = 18;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      const d = e.key === "ArrowLeft" ? -step : step;
      spin.tRy = (spin.tRy ?? spin.ry) + d;
      run();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      spin.tRx = Math.max(
        -55,
        Math.min(55, spin.tRx + (e.key === "ArrowUp" ? step : -step)),
      );
      run();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      setOpen((o) => !o);
    }
  }
  function dialogKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select")) return;
      e.preventDefault();
      onStep(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (e.key !== "Tab" || !dialog.current) return;
    const stops = [
      ...dialog.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],[tabindex="0"]',
      ),
    ];
    if (!stops.length) return;
    const firstStop = stops[0];
    const lastStop = stops[stops.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === firstStop || at === dialog.current)) {
      e.preventDefault();
      lastStop.focus();
    } else if (!e.shiftKey && at === lastStop) {
      e.preventDefault();
      firstStop.focus();
    }
  }

  const hasMore = Boolean(
    note && (note.synopsis || note.author || note.source),
  );
  return (
    <div
      className={
        "rd" + (closing ? " is-closing" : "") + (fly ? " is-flown" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby="lamplit-reader-title"
      tabIndex={-1}
      ref={dialog}
      onKeyDown={dialogKey}
      style={
        {
          "--W": W + "px",
          "--H": H + "px",
          "--D": D + "px",
          "--cloth": art.cloth,
        } as CSSProperties
      }
    >
      <div className="rd-veil" onClick={onClose} aria-hidden="true" />
      <div className="rd-bar">
        <div className="rd-steps">
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="Previous book"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="rd-place">
            {place} of {total}
          </span>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="Next book"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          className="rd-close"
          onClick={onClose}
          aria-label="Reshelve the book"
        >
          <span aria-hidden="true">Reshelve</span>
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="rd-scene">
        <div className="rd-desk" aria-hidden="true" />
        <div className="rd-stage" ref={stage}>
          <div className="rd-glow" ref={glow} aria-hidden="true" />
          <div className="rd-shadow" ref={shadow} aria-hidden="true" />
          <div className="rd-fly" ref={flyEl}>
            <div
              className={"rdb" + (open ? " is-open" : "")}
              ref={bookEl}
              role="button"
              tabIndex={0}
              aria-pressed={open}
              aria-label={
                (open ? "Close the cover of " : "Open the cover of ") +
                art.title +
                ". Drag or use the arrow keys to turn the book."
              }
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onKeyDown={bookKey}
            >
              <div className="rdb-back" />
              <div className={"rdb-spine" + (art.spine ? " has-art" : "")}>
                {art.spine && <img src={art.spine} alt="" draggable={false} />}
                <span className="rdb-spine-title">{art.title}</span>
                <span className="rdb-spine-author">{book.author}</span>
              </div>
              <div className="rdb-edge rdb-edge-side" />
              <div className="rdb-edge rdb-edge-top" />
              <div className="rdb-edge rdb-edge-foot" />
              <div className="rdb-page">
                <p className="rdb-half">{art.title}</p>
                <p className="rdb-by">{book.author}</p>
              </div>
              <div className="rdb-cover">
                <div className="rdb-cover-out">
                  {art.front ? (
                    <img
                      key={art.front}
                      src={art.front}
                      alt=""
                      draggable={false}
                      onLoad={(e) => {
                        const i = e.currentTarget;
                        if (i.naturalWidth && i.naturalHeight)
                          setAspect(
                            Math.max(
                              0.56,
                              Math.min(0.8, i.naturalWidth / i.naturalHeight),
                            ),
                          );
                      }}
                    />
                  ) : (
                    <span className="rdb-plain">
                      <b>{art.title}</b>
                      <i>{book.author}</i>
                    </span>
                  )}
                  <span className="rdb-sheen" />
                </div>
                <div className="rdb-cover-in" />
              </div>
            </div>
          </div>
        </div>

        <article className="rd-card" key={book.id}>
          <p className="rd-hint">Drag to turn it. Tap the jacket to open it.</p>
          <h2 id="lamplit-reader-title">{art.title}</h2>
          <p className="rd-author">{book.author}</p>
          <div className="rd-rule" aria-hidden="true" />
          {state === "loading" && (
            <div className="rd-wait" role="status">
              <span className="rd-sr">Fetching the synopsis.</span>
              <i />
              <i />
              <i />
            </div>
          )}
          {state === "error" && (
            <div className="rd-fail" role="alert">
              <p>The synopsis could not be fetched.</p>
              <button type="button" className="rd-text-btn" onClick={retry}>
                Try again
              </button>
            </div>
          )}
          {state === "ok" && note === null && (
            <p className="rd-none">No synopsis yet.</p>
          )}
          {state === "ok" && note && (
            <>
              <p className="rd-brief">{note.brief}</p>
              {more && (
                <div className="rd-more">
                  {note.synopsis &&
                    note.synopsis
                      .split(/\n{2,}/)
                      .map((para, i) => <p key={i}>{para}</p>)}
                  {note.author && (
                    <>
                      <h3>Author background</h3>
                      <p>{note.author}</p>
                    </>
                  )}
                  {note.source && (
                    <p className="rd-source">
                      <a href={note.source} target="_blank" rel="noreferrer">
                        Source <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    </p>
                  )}
                </div>
              )}
              {hasMore && (
                <button
                  type="button"
                  className="rd-text-btn"
                  aria-expanded={more}
                  onClick={() => setMore((m) => !m)}
                >
                  {more ? "Show less" : "Show more"}
                </button>
              )}
            </>
          )}
          <footer className="rd-foot">
            <span className="rd-plate">{book.focus}</span>
            {art.pages && art.edition && (
              <a href={art.edition} target="_blank" rel="noreferrer">
                {art.pages} pages · {art.editionLabel}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            )}
            {art.custom && (
              <span className="rd-custom">Custom library jacket</span>
            )}
          </footer>
        </article>
      </div>
    </div>
  );
}

function bookHeight() {
  const small = window.innerWidth < 720;
  return Math.round(
    Math.min(window.innerHeight * (small ? 0.4 : 0.46), small ? 300 : 430),
  );
}
