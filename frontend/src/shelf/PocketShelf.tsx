import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ShelfBook } from "../components";
import { bindingDepth, displayTitle } from "./artwork";
import { BoundVolume } from "./BoundVolume";

const gutter = 3;
const pad = 130;

// Start at the first binding whose right edge is beyond this position.
function firstAt(ends: number[], x: number) {
  let lo = 0, hi = ends.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ends[mid] <= x) lo = mid + 1; else hi = mid;
  }
  return lo;
}

const BookModel = memo(BoundVolume);
export function PocketShelf({ books, covers, open }: { books: ShelfBook[]; covers: boolean; open: (id: string) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const [turned, setTurned] = useState<string | null>(null);
  const [{width, height}, setSize] = useState({width:0, height:0});
  const zoom = Math.max(1.5, Math.min(2.12, (height - 48) / 188));
  const [position, setPosition] = useState(0);
  const frame = useRef(0);
  const anchor = useRef(0);
  const requestCenter = useRef<number | null>(0);

  const layout = useMemo(() => {
    let length = 0;
    const ends = books.map(book => {
      const size = covers || book.id === turned ? Math.ceil(112 * zoom + 8) : Math.max(30, Math.round(bindingDepth(book) * zoom));
      length += size + gutter;
      return length;
    });
    const loop = books.length > 1 && length > width + 2 * pad;
    return { ends, length, loop, inset: loop ? 0 : width / 2, copies: loop ? 3 : 1 };
  }, [books, covers, turned, width, zoom]);
  const { ends, length, loop, inset, copies } = layout;
  const start = (i: number) => i === 0 ? 0 : ends[i - 1];
  const center = (i: number) => (start(i) + ends[i] - gutter) / 2;
  const eye = position + width / 2;
  const local = Math.max(0, eye - inset);
  const active = firstAt(ends, loop ? local % length : local);
  const current = books[active];

  useLayoutEffect(() => {
    const el = rail.current!;
    let measuredWidth = 0, measuredHeight = 0;
    const measure = () => {
      const width = el.clientWidth, height = el.clientHeight;
      if (measuredWidth === width && measuredHeight === height) return;
      if (measuredWidth && requestCenter.current === null) requestCenter.current = anchor.current;
      measuredWidth = width;
      measuredHeight = height;
      setSize({width, height});
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(frame.current); };
  }, []);

  useLayoutEffect(() => {
    const el = rail.current!;
    const i = requestCenter.current;
    if (!width || i === null) return;
    requestCenter.current = null;
    el.scrollLeft = inset + (loop ? length : 0) + center(i) - width / 2;
    setPosition(el.scrollLeft);
  }, [layout]);

  // Move to the identical middle copy after momentum stops. No finger
  // tracking or synthetic inertia on touch devices.
  useEffect(() => {
    const el = rail.current!;
    let timer = 0;
    let touching = false;
    function settle() {
      if (!loop || touching) return;
      const copy = Math.floor((el.scrollLeft + width / 2) / length);
      if (copy !== 1) {
        el.scrollLeft += (1 - copy) * length;
        setPosition(el.scrollLeft);
      }
    }
    function scrolled() {
      if (!frame.current) frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        setPosition(el.scrollLeft);
      });
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 160);
    }
    const touchStart = () => { touching = true; };
    const touchEnd = () => {
      touching = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 160);
    };
    el.addEventListener("scroll", scrolled, { passive:true });
    el.addEventListener("touchstart", touchStart, { passive:true });
    el.addEventListener("touchend", touchEnd, { passive:true });
    el.addEventListener("touchcancel", touchEnd, { passive:true });
    return () => {
      el.removeEventListener("scroll", scrolled);
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchend", touchEnd);
      el.removeEventListener("touchcancel", touchEnd);
      window.clearTimeout(timer);
    };
  }, [length, loop, width]);
  useLayoutEffect(() => { anchor.current = active; }, [active]);

  function move(direction: number) {
    const el = rail.current!;
    const index = active + direction;
    if (!loop && (index < 0 || index >= books.length)) return;
    const next = (index + books.length) % books.length;
    const copy = loop ? Math.floor(local / length) + Math.floor(index / books.length) : 0;
    el.scrollTo({ left: inset + copy * length + center(next) - width / 2,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  const slots = [];
  for (let copy = 0; copy < copies; copy++) {
    const base = inset + copy * length;
    if (base > position + width + pad || base + length < position - pad) continue;
    const first = firstAt(ends, position - pad - base);
    for (let i = first; i < books.length && base + start(i) < position + width + pad; i++) {
      const book = books[i], title = displayTitle(book.title);
      const face = covers || book.id === turned;
      const left = base + start(i);
      const distance = eye - (base + center(i));
      slots.push(<div key={copy + ":" + book.id} className={"pocket-slot" + (face ? " face-out" : "")}
        style={{ left, width:ends[i] - start(i) - gutter, zIndex:face ? 1000 : 800 - Math.min(790, Math.round(Math.abs(distance))),
          "--lens-x": (eye - left) + "px" } as CSSProperties}>
        <button className="volume-pick" aria-label={(face ? "Open details for " : "Turn to cover of ") + title + " by " + book.author}
          onClick={() => {
            if (face) open(book.id);
            else { requestCenter.current = i; setTurned(book.id); }
          }}>
          <span className="pocket-scale"><BookModel book={book} showJacket={face}/></span>
        </button>
        {!covers && turned === book.id && <button className="pocket-return"
          aria-label={"Reshelve " + title} onClick={() => {requestCenter.current=i; setTurned(null);}}>Reshelve</button>}
      </div>);
    }
  }
  return <>
    <div className="pocket-case cabinet" id="bookcase">
      <div className="cornice"/><div className="bay walnut-bay"><div className="bay-floor"/>
        <div className="pocket-rail" ref={rail} tabIndex={0} role="region" aria-label="Swipe through the bookshelf"
          onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); move(e.key === "ArrowLeft" ? -1 : 1); } }}>
          <div className="pocket-track" style={{width:inset * 2 + length * copies, "--pocket-zoom":zoom} as CSSProperties}>{slots}</div>
        </div>
      </div>
      <div className="shelf-lip"><span className="brass-plate">{String(active + 1).padStart(3,"0")} / {String(books.length).padStart(3,"0")}</span></div>
    </div>
    <div className="pocket-caption">
      <div className="pocket-current"><small>{current.focus}</small>
        <button className="pocket-title" onClick={() => open(current.id)}>{displayTitle(current.title)}<ArrowUpRight size={17}/></button>
        <p>{current.author}</p></div>
      <div className="pocket-steps"><button aria-label="Previous book on shelf" disabled={!loop && active===0} onClick={()=>move(-1)}><ArrowLeft size={18}/></button>
        <button aria-label="Next book on shelf" disabled={!loop && active===books.length-1} onClick={()=>move(1)}><ArrowRight size={18}/></button></div>
    </div>
  </>;
}
