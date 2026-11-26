// The books as objects. Volume is the full hardcover you can turn and open;
// Spine and Jacket are the cheap shelf versions used by the hundred.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { bookArt, type ShelfBook } from "../../shared/catalogue";
import { cx } from "./util";

type Bookish = ShelfBook;

function useArt(book: Bookish) {
  return useMemo(
    () => bookArt(book),
    [book.id, book.title, book.author, book.cover],
  );
}

// ---------------------------------------------------------------- Volume

type VolumeProps = {
  book: Bookish;
  // Height of the book in px.
  height: number;
  // Start edge-on and turn into the light.
  enter?: boolean;
  reduced?: boolean;
  // Tap or Enter opens the cover.
  openable?: boolean;
  className?: string;
};

const REST = { ry: -28, rx: 7 };

export function Volume({
  book,
  height,
  enter,
  reduced,
  openable = true,
  className,
}: VolumeProps) {
  const art = useArt(book);
  const body = useRef<HTMLDivElement>(null);
  const pose = useRef({ ...REST, vy: 0, vx: 0 });
  const raf = useRef(0);
  const drag = useRef<{
    x: number;
    y: number;
    t: number;
    moved: number;
    id: number;
  } | null>(null);
  const [aspect, setAspect] = useState(0.66);
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const [held, setHeld] = useState(false);
  const front = broken ? undefined : art.front;

  useEffect(() => {
    setBroken(false);
    setAspect(0.66);
  }, [art.front]);

  const width = Math.round(height * aspect);
  const depth = Math.max(8, Math.round((art.depth * height) / 190));

  function apply() {
    const el = body.current;
    if (!el) return;
    el.style.setProperty("--ry", pose.current.ry.toFixed(2));
    el.style.setProperty("--rx", pose.current.rx.toFixed(2));
  }

  // Ease the pose to a target, used for the entrance and for opening.
  function glide(to: { ry: number; rx: number }, ms: number) {
    cancelAnimationFrame(raf.current);
    if (reduced) {
      pose.current = { ...to, vy: 0, vx: 0 };
      apply();
      return;
    }
    const from = { ...pose.current };
    const began = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - began) / ms);
      const e = 1 - Math.pow(1 - p, 4);
      pose.current.ry = from.ry + (to.ry - from.ry) * e;
      pose.current.rx = from.rx + (to.rx - from.rx) * e;
      apply();
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (enter && !reduced) {
      pose.current = { ry: REST.ry + 118, rx: 2, vy: 0, vx: 0 };
      apply();
      glide(REST, 1700);
    } else apply();
    return () => cancelAnimationFrame(raf.current);
    // Runs once per book.
  }, [book.id]);

  function coast() {
    cancelAnimationFrame(raf.current);
    if (reduced) return;
    const tick = () => {
      const p = pose.current;
      p.ry += p.vy;
      p.rx = Math.max(-38, Math.min(38, p.rx + p.vx));
      p.vy *= 0.94;
      p.vx *= 0.9;
      apply();
      if (Math.abs(p.vy) > 0.02 || Math.abs(p.vx) > 0.02)
        raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  function toggle() {
    if (!openable) return;
    const next = !open;
    setOpen(next);
    // Turn the book so the opening cover is in view.
    glide(next ? { ry: 26, rx: 9 } : REST, 900);
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button > 0) return;
    cancelAnimationFrame(raf.current);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      moved: 0,
      id: e.pointerId,
    };
    pose.current.vy = pose.current.vx = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    setHeld(true);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    const p = pose.current;
    p.vy = dx * 0.55;
    p.vx = -dy * 0.3;
    p.ry += p.vy;
    p.rx = Math.max(-38, Math.min(38, p.rx + p.vx));
    apply();
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setHeld(false);
    if (d.moved < 7 && performance.now() - d.t < 500) toggle();
    else coast();
  }
  function cancel() {
    drag.current = null;
    setHeld(false);
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const p = pose.current;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      cancelAnimationFrame(raf.current);
      p.ry += e.key === "ArrowLeft" ? -15 : 15;
      apply();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      cancelAnimationFrame(raf.current);
      p.rx = Math.max(-38, Math.min(38, p.rx + (e.key === "ArrowUp" ? 8 : -8)));
      apply();
    } else if (e.key === "Home") {
      e.preventDefault();
      setOpen(false);
      glide(REST, 700);
    }
  }

  const style = {
    "--h": height + "px",
    "--w": width + "px",
    "--d": depth + "px",
    "--cloth": art.cloth,
  } as CSSProperties;

  return (
    <div
      className={cx("vol", open && "is-open", held && "is-held", className)}
      style={style}
      role="button"
      tabIndex={0}
      aria-pressed={openable ? open : undefined}
      aria-label={
        art.title +
        (book.author ? " by " + book.author : "") +
        ". Drag or use the arrow keys to turn it" +
        (openable
          ? ", press Enter to " + (open ? "close" : "open") + " the cover."
          : ".")
      }
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onKeyDown={key}
    >
      <div className="vol-body" ref={body}>
        <div className="vol-face vol-back" />
        <div className="vol-face vol-spine">
          {art.spine ? (
            <img src={art.spine} alt="" draggable={false} />
          ) : (
            <span>{art.title || "Untitled"}</span>
          )}
        </div>
        <div className="vol-face vol-fore" />
        <div className="vol-face vol-top" />
        <div className="vol-face vol-bottom" />
        <div className="vol-face vol-leaf" aria-hidden="true">
          <small>{book.author}</small>
          <strong>{art.title || "Untitled"}</strong>
          <i />
          {art.pages ? <small>{art.pages} pages</small> : null}
        </div>
        <div className="vol-front">
          <div className="vol-face vol-cover">
            {front ? (
              <img
                src={front}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight)
                    setAspect(
                      Math.max(
                        0.56,
                        Math.min(0.86, img.naturalWidth / img.naturalHeight),
                      ),
                    );
                }}
                onError={() => setBroken(true)}
              />
            ) : (
              <div className="vol-blank">
                <i />
                <strong>{art.title || "Untitled"}</strong>
                <small>{book.author}</small>
                <i />
              </div>
            )}
            <span className="vol-sheen" />
          </div>
          <div className="vol-face vol-inside" />
        </div>
      </div>
      <span className="vol-shadow" aria-hidden="true" />
    </div>
  );
}

// ----------------------------------------------------------------- Spine

type ShelfProps = {
  book: Bookish;
  // Height in px of an average book on this shelf.
  size: number;
  onOpen: (id: string) => void;
  label?: string;
};

// A book standing spine-out. On hover or focus it swings out of the row far
// enough to show its cover; the cover image is only fetched then.
export function Spine({ book, size, onOpen, label }: ShelfProps) {
  const art = useArt(book);
  const [woken, setWoken] = useState(false);
  const [plain, setPlain] = useState(false);
  const h = Math.round(size * art.heightScale);
  const d = Math.max(13, Math.round((art.depth * size) / 190));
  const cover = art.small ?? art.front;
  return (
    <button
      type="button"
      className="sp"
      style={
        {
          "--h": h + "px",
          "--d": d + "px",
          "--cloth": art.cloth,
        } as CSSProperties
      }
      onClick={() => onOpen(book.id)}
      onPointerEnter={() => setWoken(true)}
      onFocus={() => setWoken(true)}
      aria-label={label ?? art.title + (book.author ? ", " + book.author : "")}
      title={art.title}
    >
      <span className="sp-box">
        <span className="sp-face">
          {art.spine && !plain ? (
            <img
              src={art.spine}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setPlain(true)}
            />
          ) : (
            <span className="sp-title">{art.title}</span>
          )}
        </span>
        <span className="sp-side">
          {woken && cover ? (
            <img src={cover} alt="" decoding="async" draggable={false} />
          ) : null}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- Jacket

// A book standing face-out, slightly turned so its spine catches the light.
export function Jacket({
  book,
  size,
  onOpen,
  label,
  still,
}: ShelfProps & { still?: boolean }) {
  const art = useArt(book);
  return (
    <button
      type="button"
      className={cx("jk", still && "is-still")}
      style={{ "--h": size + "px", "--cloth": art.cloth } as CSSProperties}
      onClick={() => onOpen(book.id)}
      aria-label={label ?? art.title + (book.author ? ", " + book.author : "")}
      title={art.title}
    >
      <Face book={book} size={size} />
    </button>
  );
}

// The flat front of a book with its bound edge, for rows, frames and cards.
export function Face({
  book,
  size,
  eager,
}: {
  book: Bookish;
  size: number;
  eager?: boolean;
}) {
  const art = useArt(book);
  const [broken, setBroken] = useState(false);
  const src = size < 200 ? (art.small ?? art.front) : (art.front ?? art.small);
  useEffect(() => setBroken(false), [src]);
  return (
    <span
      className="face"
      style={{ "--h": size + "px", "--cloth": art.cloth } as CSSProperties}
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="face-blank">
          <strong>{art.title || "Untitled"}</strong>
          <small>{book.author}</small>
        </span>
      )}
    </span>
  );
}
