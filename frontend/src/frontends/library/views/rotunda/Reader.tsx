// The reader: the chosen book hangs under the oculus light at the centre of
// the room, free to turn in the hand, with its text on a brass-edged card.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import {
  bookArt,
  useNote,
  type BookArt,
  type ShelfBook,
} from "../../../../shared/catalogue";
import { clamp } from "./room";
import { plane } from "./Shelf";

// Where the shelf copy is on screen: its centre, its height, and whether it
// shows its spine.
export type Place = { x: number; y: number; h: number; spine: boolean };

type Pose = { rx: number; ry: number };
const REST: Pose = { rx: 7, ry: -26 };

function Jacket({
  book,
  art,
  height,
  startSpine,
  closing,
  landSpine,
  still,
}: {
  book: ShelfBook;
  art: BookArt;
  height: number;
  startSpine: boolean | null;
  closing: boolean;
  landSpine: boolean;
  still: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [aspect, setAspect] = useState(0.655);
  const [noCover, setNoCover] = useState(false);
  const [noSpine, setNoSpine] = useState(false);
  const body = useRef<HTMLSpanElement>(null);
  const s = useRef({
    rx: startSpine === null ? REST.rx : 0,
    ry: startSpine === null ? REST.ry : startSpine ? 90 : 0,
    vx: 0,
    vy: 0,
    goal: (startSpine === null ? null : { ...REST }) as Pose | null,
    hold: false,
    drag: false,
    moved: 0,
    px: 0,
    py: 0,
    pt: 0,
    raf: 0,
    last: 0,
  });
  const hb = height,
    wb = Math.round(hb * aspect),
    tb = Math.max(14, Math.round((art.depth * hb) / 190));

  const apply = () => {
    if (body.current)
      body.current.style.transform = `rotateX(${s.current.rx.toFixed(2)}deg) rotateY(${s.current.ry.toFixed(2)}deg)`;
  };
  const run = () => {
    const m = s.current;
    if (m.raf) return;
    m.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.034, (now - m.last) / 1000);
      m.last = now;
      let moving = false;
      if (m.drag) moving = true;
      else if (m.goal) {
        const g = m.goal;
        m.vx += (-58 * (m.rx - g.rx) - 11 * m.vx) * dt;
        m.vy += (-58 * (m.ry - g.ry) - 11 * m.vy) * dt;
        m.rx += m.vx * dt;
        m.ry += m.vy * dt;
        moving = true;
        if (
          Math.abs(m.rx - g.rx) + Math.abs(m.ry - g.ry) < 0.05 &&
          Math.abs(m.vx) + Math.abs(m.vy) < 0.4
        ) {
          m.rx = g.rx;
          m.ry = g.ry;
          m.vx = m.vy = 0;
          if (!m.hold) m.goal = null;
          moving = false;
        }
      } else {
        m.ry += m.vy * dt;
        m.rx += m.vx * dt;
        const fr = Math.exp(-2.6 * dt);
        m.vy *= fr;
        m.vx *= fr;
        // The book drifts back to a readable tilt once it is let go.
        const over = m.rx - clamp(m.rx, -24, 24);
        m.rx -= over * Math.min(1, 5 * dt);
        moving = Math.abs(m.vx) + Math.abs(m.vy) > 1.5 || Math.abs(over) > 0.05;
      }
      apply();
      m.raf = moving ? requestAnimationFrame(tick) : 0;
    };
    m.raf = requestAnimationFrame(tick);
  };

  useLayoutEffect(() => {
    apply();
    if (still) {
      s.current.rx = REST.rx;
      s.current.ry = REST.ry;
      s.current.goal = null;
      apply();
    } else run();
    const m = s.current;
    return () => {
      cancelAnimationFrame(m.raf);
      m.raf = 0;
    };
    // Mount only: the motion lives in the ref.
  }, []);

  useEffect(() => {
    if (!closing) return;
    const m = s.current;
    setOpen(false);
    const turns = Math.round(m.ry / 360) * 360;
    m.goal = { rx: 0, ry: turns + (landSpine ? 90 : 0) };
    m.hold = true;
    if (!still) run();
  }, [closing]);

  const toggle = () => {
    const m = s.current;
    const next = !open;
    setOpen(next);
    if (still) return;
    const turns = Math.round(m.ry / 360) * 360;
    m.goal = next
      ? { rx: 9, ry: turns + 14 }
      : { rx: REST.rx, ry: turns + REST.ry };
    m.hold = false;
    run();
  };
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (closing) return;
    const m = s.current;
    m.drag = true;
    m.moved = 0;
    m.goal = null;
    m.vx = m.vy = 0;
    m.px = e.clientX;
    m.py = e.clientY;
    m.pt = performance.now();
    e.currentTarget.setPointerCapture(e.pointerId);
    run();
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const m = s.current;
    if (!m.drag) return;
    const dx = e.clientX - m.px,
      dy = e.clientY - m.py;
    const now = performance.now();
    const dt = Math.max(0.004, (now - m.pt) / 1000);
    m.px = e.clientX;
    m.py = e.clientY;
    m.pt = now;
    m.moved += Math.abs(dx) + Math.abs(dy);
    m.ry += dx * 0.55;
    m.rx = clamp(m.rx - dy * 0.4, -78, 78);
    m.vy = m.vy * 0.5 + ((dx * 0.55) / dt) * 0.5;
    m.vx = m.vx * 0.5 + ((-dy * 0.4) / dt) * 0.5;
  };
  const up = () => {
    const m = s.current;
    if (!m.drag) return;
    m.drag = false;
    if (performance.now() - m.pt > 90) m.vx = m.vy = 0;
    m.vy = clamp(m.vy, -900, 900);
    m.vx = clamp(m.vx, -500, 500);
    run();
  };
  const key = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [0, -15],
      ArrowRight: [0, 15],
      ArrowUp: [10, 0],
      ArrowDown: [-10, 0],
    };
    const by = step[e.key];
    if (!by) return;
    e.preventDefault();
    e.stopPropagation();
    const m = s.current;
    const from = m.goal ?? { rx: m.rx, ry: m.ry };
    m.goal = { rx: clamp(from.rx + by[0], -78, 78), ry: from.ry + by[1] };
    m.hold = false;
    if (still) {
      m.rx = m.goal.rx;
      m.ry = m.goal.ry;
      m.goal = null;
      apply();
    } else run();
  };

  return (
    <button
      type="button"
      className={"jacket" + (open ? " open" : "")}
      style={{ width: Math.max(wb + 120, hb * 0.9), height: hb + 70 }}
      aria-pressed={open}
      aria-label={`${art.title}, the book itself. Drag or use the arrow keys to turn it. Press Enter to ${open ? "close" : "open"} the cover.`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      onClick={(e) => {
        // A keyboard click has no pointer travel; a drag does.
        if (e.detail === 0 || s.current.moved < 7) toggle();
      }}
    >
      <span className="jacket-floor" aria-hidden="true" />
      <span className="jacket-persp" aria-hidden="true">
        <span
          className="rb"
          ref={body}
          style={{ "--cloth": art.cloth } as CSSProperties}
        >
          <span className="rf back" style={plane(wb, hb, 0, 0, -tb / 2, 180)} />
          <span
            className="rf leaves"
            style={plane(tb - 5, hb - 8, wb / 2 - 4, 0, 0, 90)}
          />
          <span
            className="rf leaves top"
            style={plane(wb - 6, tb - 5, -1, -hb / 2 + 4, 0, 0, 90)}
          />
          <span
            className="rf leaves top"
            style={plane(wb - 6, tb - 5, -1, hb / 2 - 4, 0, 0, -90)}
          />
          <span className="rf spine" style={plane(tb, hb, -wb / 2, 0, 0, -90)}>
            <span className="spine-title">{art.title}</span>
            {art.spine && !noSpine && (
              <img
                src={art.spine}
                alt=""
                draggable={false}
                onError={() => setNoSpine(true)}
              />
            )}
          </span>
          <span
            className="rf halftitle"
            style={plane(wb - 5, hb - 8, -1, 0, tb / 2 - 2.5)}
          >
            <strong>{art.title}</strong>
            <em>{book.author}</em>
          </span>
          <span
            className="lid"
            style={{
              transform: `translate3d(${-wb / 2}px,0,${tb / 2}px) rotateY(${open ? -152 : 0}deg)`,
            }}
          >
            <span
              className="rf endpaper"
              style={plane(wb, hb, wb / 2, 0, -0.6, 180)}
            />
            <span className="rf cover" style={plane(wb, hb, wb / 2, 0, 0)}>
              <span className="front-title">
                {art.title}
                <i>{book.author}</i>
              </span>
              {art.front && !noCover && (
                <img
                  src={art.front}
                  alt=""
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth && img.naturalHeight)
                      setAspect(
                        clamp(img.naturalWidth / img.naturalHeight, 0.56, 0.82),
                      );
                  }}
                  onError={() => setNoCover(true)}
                />
              )}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

function Synopsis({ book, art }: { book: ShelfBook; art: BookArt }) {
  const { note, state, retry } = useNote(book.id);
  const [more, setMore] = useState(false);
  return (
    <>
      {state === "loading" && (
        <p className="note-wait" role="status">
          <span />
          <span />
          <span />
          <b className="sr-only">Fetching the synopsis</b>
        </p>
      )}
      {state === "error" && (
        <p className="note-missing" role="alert">
          The synopsis did not arrive.{" "}
          <button type="button" className="brass-link" onClick={retry}>
            Try again
          </button>
        </p>
      )}
      {state === "ok" && note === null && (
        <p className="note-missing">No synopsis yet.</p>
      )}
      {state === "ok" && note && (
        <>
          <p className="brief">{note.brief}</p>
          {!more && (note.synopsis || note.author) && (
            <button
              type="button"
              className="more"
              aria-expanded={false}
              onClick={() => setMore(true)}
            >
              Show more
            </button>
          )}
          {more && (
            <div className="long">
              {note.synopsis && <p>{note.synopsis}</p>}
              {note.author && (
                <>
                  <h3>Author background</h3>
                  <p>{note.author}</p>
                </>
              )}
              {note.source && (
                <p className="source">
                  <a href={note.source} target="_blank" rel="noreferrer">
                    Source <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                </p>
              )}
              <button
                type="button"
                className="more"
                aria-expanded={true}
                onClick={() => setMore(false)}
              >
                Show less
              </button>
            </div>
          )}
        </>
      )}
      <footer className="imprint">
        <span>{book.focus}</span>
        {art.pages && art.edition && (
          <a href={art.edition} target="_blank" rel="noreferrer">
            {art.pages} pages · {art.editionLabel}
            <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        )}
        {art.custom && <small>Custom library jacket</small>}
      </footer>
    </>
  );
}

export function Reader({
  book,
  closing,
  origin,
  landing,
  still,
  place,
  onClose,
  onClosed,
  onStep,
}: {
  book: ShelfBook;
  closing: boolean;
  origin: Place | null;
  landing: Place;
  still: boolean;
  place: string;
  onClose: () => void;
  onClosed: () => void;
  onStep: (by: number) => void;
}) {
  const art = bookArt(book);
  const root = useRef<HTMLDivElement>(null);
  const fly = useRef<HTMLSpanElement>(null);
  const first = useRef(book.id);
  const [height, setHeight] = useState(() =>
    typeof window === "undefined"
      ? 300
      : Math.round(clamp(window.innerHeight * 0.36, 210, 350)),
  );
  useEffect(() => {
    const size = () =>
      setHeight(Math.round(clamp(window.innerHeight * 0.36, 210, 350)));
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, []);

  // The flight from the shelf to the light.
  useLayoutEffect(() => {
    root.current?.focus({ preventScroll: true });
    const el = fly.current;
    if (!el || !origin || still) return;
    const r = el.getBoundingClientRect();
    const dx = origin.x - (r.left + r.width / 2),
      dy = origin.y - (r.top + r.height / 2);
    const k = origin.h / height;
    // Off the shelf, up towards the light in an arc, a touch past full size
    // as it arrives, then settling into the hand.
    const lift = Math.min(90, window.innerHeight * 0.08);
    const anim = el.animate(
      [
        { transform: `translate(${dx}px,${dy}px) scale(${k})`, offset: 0 },
        {
          transform: `translate(${dx}px,${dy - 14}px) scale(${k * 1.06})`,
          offset: 0.1,
        },
        {
          transform: `translate(${dx * 0.46}px,${dy * 0.34 - lift}px) scale(${k + (1 - k) * 0.6})`,
          offset: 0.5,
        },
        { transform: "translate(0,-6px) scale(1.035)", offset: 0.84 },
        { transform: "translate(0,0) scale(1)", offset: 1 },
      ],
      { duration: 1080, easing: "cubic-bezier(.32,.04,.22,1)" },
    );
    return () => anim.cancel();
  }, []);

  // The flight home.
  useEffect(() => {
    if (!closing) return;
    const el = fly.current;
    if (!el || still) {
      const t = window.setTimeout(onClosed, still ? 160 : 0);
      return () => clearTimeout(t);
    }
    const r = el.getBoundingClientRect();
    const dx = landing.x - (r.left + r.width / 2),
      dy = landing.y - (r.top + r.height / 2);
    const k = landing.h / height;
    const anim = el.animate(
      [
        { transform: "translate(0,0) scale(1)" },
        {
          transform: `translate(${dx * 0.5}px,${dy * 0.5 - Math.min(60, window.innerHeight * 0.05)}px) scale(${(1 + k) / 2})`,
          offset: 0.45,
        },
        { transform: `translate(${dx}px,${dy}px) scale(${k})` },
      ],
      { duration: 640, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" },
    );
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onClosed();
    };
    anim.onfinish = finish;
    const guard = window.setTimeout(finish, 900);
    return () => {
      clearTimeout(guard);
      anim.onfinish = null;
    };
  }, [closing]);

  const keys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      onStep(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (e.key !== "Tab" || !root.current) return;
    const items = Array.from(
      root.current.querySelectorAll<HTMLElement>("button, a[href]"),
    ).filter((n) => n.offsetParent !== null || n.getClientRects().length);
    if (!items.length) return;
    const firstItem = items[0],
      last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === firstItem || at === root.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      firstItem.focus();
    }
  };

  return (
    <div
      ref={root}
      className={"reader" + (closing ? " closing" : "")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fx-rotunda-reader-title"
      tabIndex={-1}
      onKeyDown={keys}
      onClick={(e) => {
        if (
          e.target === e.currentTarget ||
          (e.target as HTMLElement).classList.contains("reader-stage")
        )
          onClose();
      }}
    >
      <div className="reader-beam" aria-hidden="true" />
      <div className="reader-bar">
        <button type="button" className="round" onClick={() => onStep(-1)}>
          <ArrowLeft size={17} aria-hidden="true" />
          <span className="sr-only">Previous book</span>
        </button>
        <span className="reader-place">{place}</span>
        <button type="button" className="round" onClick={() => onStep(1)}>
          <ArrowRight size={17} aria-hidden="true" />
          <span className="sr-only">Next book</span>
        </button>
        <button type="button" className="round close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
          <span className="sr-only">
            Close and return the book to its shelf
          </span>
        </button>
      </div>
      <div className="reader-stage" style={{ height: height + 96 }}>
        <span className="fly" ref={fly} style={{ height }}>
          <Jacket
            key={book.id}
            book={book}
            art={art}
            height={height}
            startSpine={
              book.id === first.current && origin && !still
                ? origin.spine
                : null
            }
            closing={closing}
            landSpine={landing.spine}
            still={still}
          />
        </span>
      </div>
      <p className="reader-hint" aria-hidden="true">
        Drag to turn it over. Tap to open the cover.
      </p>
      <article className="card" key={book.id}>
        <span className="card-corner tl" aria-hidden="true" />
        <span className="card-corner tr" aria-hidden="true" />
        <span className="card-corner bl" aria-hidden="true" />
        <span className="card-corner br" aria-hidden="true" />
        <h2 id="fx-rotunda-reader-title">{art.title}</h2>
        <p className="byline">{book.author}</p>
        <Synopsis book={book} art={art} />
      </article>
    </div>
  );
}
