// The reader: the chosen book leaves its shelf, the four rays meet behind
// it as white light, and its text sets beneath like a specimen label.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { focuses, useNote } from "../../shared/catalogue";
import { RAYS, clamp, type Item } from "./layout";

type SpecimenProps = {
  item: Item;
  origin: DOMRect | null; // where the shelf copy stands, for the first book only
  stepped: boolean; // reached with previous or next
  shelfAngle: number; // how the book was turned on the glass, degrees
  closing: boolean;
  reduce: boolean;
  rectOf: (id: string) => DOMRect | null;
  onExited: () => void;
};

const REST_Y = 24;
const REST_X = -7;

function Specimen({
  item,
  origin,
  stepped,
  shelfAngle,
  closing,
  reduce,
  rectOf,
  onExited,
}: SpecimenProps) {
  const { art, book } = item;
  const { note, state, retry } = useNote(book.id);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [aspect, setAspect] = useState(0.66);
  const [size, setSize] = useState(() => pick());
  const flyRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rot = useRef({
    x: origin && !reduce ? 0 : REST_X,
    y: origin && !reduce ? shelfAngle : REST_Y,
    vx: 0,
    vy: 0,
    drag: false,
    ty: REST_Y,
    tx: REST_X,
    hold: false, // closing: head for the shelf angle
  });
  const openRef = useRef(open);
  openRef.current = open;

  function pick() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return Math.round(
      clamp(Math.min(vh * (vw < 720 ? 0.36 : 0.43), vw * 0.72), 200, 430),
    );
  }
  useEffect(() => {
    const on = () => setSize(pick());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const h = size;
  const w = Math.round(h * aspect);
  const d = Math.max(10, Math.round((art.depth * h) / 190));

  // Rotation: inertia after a drag, then a spring to the nearest rest pose.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const r = rot.current;
      if (!r.drag) {
        const restY = openRef.current ? 12 : REST_Y;
        if (r.hold)
          r.ty = shelfAngle + 360 * Math.round((r.y - shelfAngle) / 360);
        else if (openRef.current)
          r.ty = restY + 360 * Math.round((r.y - restY) / 360);
        else r.ty = restY + 180 * Math.round((r.y - restY) / 180);
        r.tx = r.hold ? 0 : REST_X;
        if (reduce) {
          r.y = r.ty;
          r.x = r.tx;
          r.vx = r.vy = 0;
        } else if (Math.abs(r.vy) > 90 && !r.hold) {
          r.y += r.vy * dt;
          r.vy *= Math.exp(-dt * 2.4);
          r.x += r.vx * dt;
          r.vx *= Math.exp(-dt * 4);
        } else {
          const k = r.hold ? 90 : 46;
          const c = r.hold ? 17 : 9.5;
          r.vy += (-(r.y - r.ty) * k - r.vy * c) * dt;
          r.y += r.vy * dt;
          r.vx += (-(r.x - r.tx) * k - r.vx * c) * dt;
          r.x += r.vx * dt;
        }
        r.x = clamp(r.x, -70, 70);
      }
      const el = bodyRef.current;
      if (el)
        el.style.transform = `rotateX(${r.x.toFixed(2)}deg) rotateY(${r.y.toFixed(2)}deg)`;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce, shelfAngle]);

  // Arrival. A book taken from the shelf flies from where it stood; one
  // reached by stepping slides in along the ray. A book opened straight
  // from a link is simply there. Transform only, so nothing can be left
  // invisible if the animation never runs.
  useLayoutEffect(() => {
    const el = flyRef.current;
    if (!el || reduce || typeof el.animate !== "function") return;
    if (!origin && !stepped) return;
    const to = el.getBoundingClientRect();
    let from: string;
    if (origin) {
      const k = clamp(origin.height / to.height, 0.1, 3);
      const dx = origin.left + origin.width / 2 - (to.left + to.width / 2);
      const dy = origin.top + origin.height / 2 - (to.top + to.height / 2);
      from = `translate3d(${dx}px,${dy}px,0) scale(${k})`;
    } else {
      from = "translate3d(-90px,0,0) scale(.86)";
    }
    const a = el.animate([{ transform: from }, { transform: "none" }], {
      duration: origin ? 780 : 420,
      easing: "cubic-bezier(.22,.9,.24,1)",
    });
    return () => a.cancel();
    // Runs once per specimen; the origin belongs to the moment of opening.
  }, []);

  // Departure: back along its ray to the gap it left on the glass.
  useEffect(() => {
    if (!closing) return;
    setOpen(false);
    const el = flyRef.current;
    if (!el || reduce || typeof el.animate !== "function") {
      const t = window.setTimeout(onExited, reduce ? 120 : 0);
      return () => window.clearTimeout(t);
    }
    rot.current.hold = true;
    rot.current.drag = false;
    const dest = rectOf(book.id);
    const now = el.getBoundingClientRect();
    let to: string;
    if (dest && dest.width > 0) {
      const k = clamp(dest.height / now.height, 0.1, 3);
      const dx = dest.left + dest.width / 2 - (now.left + now.width / 2);
      const dy = dest.top + dest.height / 2 - (now.top + now.height / 2);
      to = `translate3d(${dx}px,${dy}px,0) scale(${k})`;
    } else {
      to = `translate3d(${-window.innerWidth * 0.7}px,0,0) scale(.25)`;
    }
    const a = el.animate([{ transform: "none" }, { transform: to }], {
      duration: 560,
      easing: "cubic-bezier(.5,0,.2,1)",
      fill: "forwards",
    });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onExited();
    };
    a.onfinish = finish;
    const guard = window.setTimeout(finish, 800);
    return () => window.clearTimeout(guard);
  }, [closing]);

  // Dragging turns the book; a press without a drag opens the cover.
  const press = useRef({ id: -1, x: 0, y: 0, moved: false, t: 0 });
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || closing) return;
    press.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      t: performance.now(),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    rot.current.drag = true;
    rot.current.vx = rot.current.vy = 0;
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 6) return;
    if (!p.moved) {
      p.moved = true;
      if (openRef.current) setOpen(false);
    }
    const now = performance.now();
    const dt = Math.max(8, now - p.t) / 1000;
    const r = rot.current;
    r.y += dx * 0.55;
    r.x = clamp(r.x - dy * 0.4, -70, 70);
    r.vy = (dx * 0.55) / dt;
    r.vx = (-dy * 0.4) / dt;
    p.x = e.clientX;
    p.y = e.clientY;
    p.t = now;
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (p.id !== e.pointerId) return;
    p.id = -1;
    const r = rot.current;
    r.drag = false;
    if (performance.now() - p.t > 90) r.vx = r.vy = 0;
    r.vy = clamp(r.vy, -900, 900);
    if (!p.moved && e.type === "pointerup") toggle();
  };
  const toggle = useCallback(() => {
    setOpen((v) => !v);
    rot.current.vy = 0;
  }, []);
  const keys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const r = rot.current;
    const push = reduce ? 0 : 1;
    if (e.key === "ArrowLeft") {
      if (reduce) r.y -= 30;
      r.vy = -260 * push;
    } else if (e.key === "ArrowRight") {
      if (reduce) r.y += 30;
      r.vy = 260 * push;
    } else if (e.key === "ArrowUp") r.vx = 220;
    else if (e.key === "ArrowDown") r.vx = -220;
    else if (e.key === "Enter" || e.key === " ") toggle();
    else return;
    if (e.key.startsWith("Arrow") && openRef.current) setOpen(false);
    e.preventDefault();
    e.stopPropagation();
  };

  const vars = {
    "--w": w + "px",
    "--h": h + "px",
    "--d": d + "px",
    "--cloth": art.cloth,
    "--ray": RAYS[item.shelf],
  } as CSSProperties;

  return (
    <div
      className="sp-specimen"
      style={vars}
      data-open={open || undefined}
      data-closing={closing || undefined}
    >
      <div className="sp-stage">
        <div className="sp-halo" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <b />
          <u />
        </div>
        <div className="sp-fly" ref={flyRef}>
          <div
            className="sp-hc-hit"
            role="button"
            tabIndex={0}
            aria-pressed={open}
            aria-label={
              art.title +
              ". Drag or use the arrow keys to turn the book. Press Enter to " +
              (open ? "close" : "open") +
              " the cover."
            }
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={keys}
          >
            <div
              className="sp-hc"
              ref={bodyRef}
              style={{
                transform: `rotateX(${rot.current.x}deg) rotateY(${rot.current.y}deg)`,
              }}
            >
              <div className="sp-hc-back" />
              <div className="sp-hc-spine">
                {art.spine ? (
                  <img src={art.spine} alt="" draggable={false} />
                ) : (
                  <span>{art.title}</span>
                )}
              </div>
              <div className="sp-hc-edge sp-hc-fore" />
              <div className="sp-hc-edge sp-hc-top" />
              <div className="sp-hc-edge sp-hc-foot" />
              <div className="sp-hc-page">
                <span className="sp-mono">half title</span>
                <strong>{art.title}</strong>
                <em>{book.author}</em>
              </div>
              <div className="sp-hc-cover">
                <div className="sp-hc-outer">
                  {art.front ? (
                    <img
                      src={art.front}
                      alt=""
                      draggable={false}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalHeight > 0)
                          setAspect(
                            clamp(
                              img.naturalWidth / img.naturalHeight,
                              0.56,
                              0.82,
                            ),
                          );
                      }}
                    />
                  ) : (
                    <span>{art.title}</span>
                  )}
                </div>
                <div className="sp-hc-inner" />
              </div>
            </div>
          </div>
        </div>
        <p className="sp-mono sp-stage-hint" aria-hidden="true">
          drag to turn · tap to {open ? "close" : "open"}
        </p>
      </div>

      <article className="sp-card">
        <p className="sp-mono sp-card-over">
          <i />
          Specimen · {focuses[item.shelf]}
        </p>
        <h2 id="sp-reader-title">{art.title}</h2>
        <p className="sp-card-author">{book.author}</p>
        <div className="sp-card-rule" aria-hidden="true" />
        {state === "loading" && (
          <p className="sp-card-wait sp-mono" role="status">
            Focusing the synopsis
          </p>
        )}
        {state === "error" && (
          <p className="sp-card-wait" role="alert">
            The synopsis could not be loaded.{" "}
            <button type="button" className="sp-link" onClick={retry}>
              Try again
            </button>
          </p>
        )}
        {state === "ok" && note === null && (
          <p className="sp-card-brief">No synopsis yet.</p>
        )}
        {state === "ok" && note && (
          <>
            <p className="sp-card-brief">{note.brief}</p>
            {more ? (
              <div className="sp-card-more">
                {note.synopsis && <p>{note.synopsis}</p>}
                {note.author && (
                  <>
                    <h3 className="sp-mono">Author background</h3>
                    <p>{note.author}</p>
                  </>
                )}
                {note.source && (
                  <p>
                    <a
                      className="sp-link"
                      href={note.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source
                    </a>
                  </p>
                )}
                <button
                  type="button"
                  className="sp-btn"
                  onClick={() => setMore(false)}
                >
                  Show less
                </button>
              </div>
            ) : (
              (note.synopsis || note.author || note.source) && (
                <button
                  type="button"
                  className="sp-btn"
                  aria-expanded={false}
                  onClick={() => setMore(true)}
                >
                  Show more
                </button>
              )
            )}
          </>
        )}
        <dl className="sp-card-meta sp-mono">
          <div>
            <dt>Category</dt>
            <dd>{focuses[item.shelf]}</dd>
          </div>
          {art.pages && art.edition && (
            <div>
              <dt>Edition</dt>
              <dd>
                <a
                  className="sp-link"
                  href={art.edition}
                  target="_blank"
                  rel="noreferrer"
                >
                  {art.pages} pages · {art.editionLabel}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {art.custom && (
          <p className="sp-mono sp-card-custom">Custom library jacket</p>
        )}
      </article>
    </div>
  );
}

type ReaderProps = {
  item: Item;
  origin: DOMRect | null;
  shelfAngle: number;
  closing: boolean;
  reduce: boolean;
  rectOf: (id: string) => DOMRect | null;
  onClose: () => void;
  onExited: () => void;
  onStep: ((dir: 1 | -1) => void) | null;
  place: string; // "12 of 61" within the current order
};

export default function Reader(props: ReaderProps) {
  const { item, closing, onClose, onStep } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const first = useRef(item.book.id);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);
  // Only the book that was clicked flies from the shelf; later ones arrive
  // along the ray.
  useEffect(() => {
    if (item.book.id !== first.current) first.current = "";
  }, [item.book.id]);

  const keys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && onStep) {
      e.preventDefault();
      onStep(e.key === "ArrowRight" ? 1 : -1);
      return;
    }
    if (e.key !== "Tab") return;
    const root = rootRef.current;
    if (!root) return;
    const list = Array.from(
      root.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]'),
    ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (!list.length) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey
      ? at <= 0
        ? list[list.length - 1]
        : list[at - 1]
      : at < 0 || at === list.length - 1
        ? list[0]
        : list[at + 1];
    e.preventDefault();
    next.focus();
  };

  return (
    <div
      className="sp-reader"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sp-reader-title"
      tabIndex={-1}
      data-closing={closing || undefined}
      onKeyDown={keys}
    >
      <div className="sp-reader-veil" onClick={onClose} aria-hidden="true" />
      <div className="sp-reader-bar">
        <span className="sp-mono">{props.place}</span>
        <button
          type="button"
          className="sp-icon"
          onClick={onClose}
          aria-label="Close and return the book to its shelf"
        >
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div
        className="sp-reader-scroll"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <Specimen
          key={item.book.id}
          item={item}
          origin={first.current === item.book.id ? props.origin : null}
          stepped={first.current !== item.book.id}
          shelfAngle={props.shelfAngle}
          closing={closing}
          reduce={props.reduce}
          rectOf={props.rectOf}
          onExited={props.onExited}
        />
      </div>
      {onStep && (
        <nav className="sp-reader-nav" aria-label="Neighbouring books">
          <button
            type="button"
            className="sp-icon"
            onClick={() => onStep(-1)}
            aria-label="Previous book"
          >
            <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="sp-icon"
            onClick={() => onStep(1)}
            aria-label="Next book"
          >
            <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
