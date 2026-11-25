// The plate: the photographed shelf in the DOM, the inked sheet on a canvas
// above it, and the things that stand proud of both (the lifted book, its
// callout, the lamp).
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { focuses, warmNote } from "../../shared/catalogue";
import { Ink } from "./ink";
import {
  letters,
  maxDepth,
  plan,
  type Mode,
  type Section,
  type Slot,
} from "./layout";

export function Glyph({ cat }: { cat: number }) {
  return (
    <svg className="glyph" viewBox="0 0 12 12" aria-hidden="true">
      {cat === 0 && <circle cx="6" cy="6" r="3.6" />}
      {cat === 1 && <rect x="2.5" y="2.5" width="7" height="7" />}
      {cat === 2 && <path d="M6 2 L10.2 9.6 L1.8 9.6 Z" />}
      {cat === 3 && <path d="M6 1.4 L10.6 6 L6 10.6 L1.4 6 Z" />}
    </svg>
  );
}

// Spine depth against the thickest spine on the shelf. A ratio, not a size.
export function DepthBar({ depth }: { depth: number }) {
  const rel = Math.min(1, depth / maxDepth);
  return (
    <span className="depth">
      <span className="depth-bar" aria-hidden="true">
        <i style={{ width: rel * 100 + "%" }} />
      </span>
      {rel.toFixed(2)} rel.
    </span>
  );
}

const Vol = memo(function Vol({
  s,
  mode,
  hot,
  out,
}: {
  s: Slot;
  mode: Mode;
  hot: boolean;
  out: boolean;
}) {
  const src =
    mode === "spines"
      ? s.art.spine
      : ((s.w < 130 ? s.art.small : s.art.front) ?? s.art.front);
  return (
    <button
      type="button"
      className={
        "bk" +
        (s.active ? "" : " off") +
        (hot ? " hot" : "") +
        (out ? " out" : "")
      }
      data-book={s.book.id}
      data-i={s.i}
      aria-label={s.art.title + ", by " + s.book.author}
      style={
        {
          left: s.x,
          top: s.y,
          width: s.w,
          height: s.h,
          "--cloth": s.art.cloth,
          "--edge": Math.max(3, Math.round(s.art.depth * 0.22)) + "px",
        } as CSSProperties
      }
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        <span className="bk-blank">{s.art.title}</span>
      )}
    </button>
  );
});

function Lift({ s, mode, width }: { s: Slot; mode: Mode; width: number }) {
  const spines = mode === "spines";
  const coverW = spines ? Math.round(s.h * 0.66) : s.w;
  const depth = spines
    ? s.w
    : Math.max(8, Math.round((s.art.depth * s.h) / 190));
  // Keep the swung cover on the sheet near the right edge.
  const reach = s.x + s.w + coverW * 0.72 + 12 - width;
  const shift = spines ? -Math.max(0, reach) : s.x < depth ? depth - s.x : 0;
  return (
    <div
      className={"lift " + mode}
      aria-hidden="true"
      style={
        {
          left: s.x,
          top: s.y,
          width: s.w,
          height: s.h,
          "--shift": shift + "px",
          "--cloth": s.art.cloth,
        } as CSSProperties
      }
    >
      <div className="lift-box">
        {spines ? (
          <>
            <span className="lf lf-spine">
              {s.art.spine && <img src={s.art.spine} alt="" />}
            </span>
            <span className="lf lf-cover" style={{ width: coverW }}>
              {s.art.front && <img src={s.art.front} alt="" />}
            </span>
          </>
        ) : (
          <>
            <span className="lf lf-side" style={{ width: depth, left: -depth }}>
              {s.art.spine && <img src={s.art.spine} alt="" />}
            </span>
            <span className="lf lf-face">
              {s.art.front && <img src={s.art.front} alt="" />}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Callout({
  s,
  below,
  width,
  total,
  compact,
}: {
  s: Slot;
  below: boolean;
  width: number;
  total: number;
  compact: boolean;
}) {
  const boxW = compact ? 214 : 268;
  const ax = s.x + s.w / 2;
  const ay = below ? s.y + s.h + 4 : s.y - 4;
  const rise = below ? 40 : -40;
  let left = ax + 22;
  if (left + boxW > width - 4) left = Math.max(4, ax - 22 - boxW);
  const elbowX = left > ax ? ax + 16 : ax - 16;
  const endX = left > ax ? left + boxW : left;
  return (
    <>
      <svg
        className="leader"
        style={{ left: ax, top: ay }}
        width="1"
        height="1"
        aria-hidden="true"
      >
        <polyline
          pathLength={1}
          points={`0,0 ${elbowX - ax},${rise} ${endX - ax},${rise}`}
        />
        <circle r="2.6" />
      </svg>
      <div
        className={"callout" + (below ? " below" : "")}
        style={{ left, top: ay + rise, width: boxW }}
        aria-hidden="true"
      >
        <span className="co-top">
          <span>
            Vol. {String(s.no).padStart(3, "0")} / {total}
          </span>
          <span>
            <Glyph cat={s.cat} /> {letters[s.cat]}
          </span>
        </span>
        <strong>{s.art.title}</strong>
        <span className="co-by">{s.book.author}</span>
        <span className="co-spec">
          <span>{s.art.pages ? s.art.pages + " pp." : "pp. not recorded"}</span>
          <span>
            Spine <DepthBar depth={s.art.depth} />
          </span>
        </span>
        <span className="co-cat">{focuses[s.cat]}</span>
      </div>
    </>
  );
}

function Compass() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="24" className="c-ring" />
      <circle cx="32" cy="32" r="29.5" className="c-dash" />
      <path d="M32 2v9M32 53v9M2 32h9M53 32h9" className="c-tick" />
      <path d="M32 10 L37 32 L32 54 L27 32 Z" className="c-needle" />
      <path d="M32 10 L37 32 L27 32 Z" className="c-north" />
      <path d="M12 32 L32 28.5 L52 32 L32 35.5 Z" className="c-needle" />
      <circle cx="32" cy="32" r="3.4" className="c-bulb" />
    </svg>
  );
}

export function Sheet({
  sections,
  mode,
  compact,
  reduced,
  developAll,
  filtered,
  paused,
  openId,
  total,
  onOpen,
  empty,
}: {
  sections: Section[];
  mode: Mode;
  compact: boolean;
  reduced: boolean;
  developAll: boolean;
  filtered: boolean;
  paused: boolean;
  openId: string | null;
  total: number;
  onOpen: (id: string) => void;
  empty?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<Ink | null>(null);
  const plotted = useRef<{ sections: Section[]; mode: Mode } | null>(null);
  const [width, setWidth] = useState(0);
  const [bare, setBare] = useState(false);
  const [hot, setHot] = useState<{ id: string; below: boolean } | null>(null);
  const [lamp, setLamp] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ on: false, moved: false });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pl = useMemo(
    () => plan(sections, Math.max(width, 200), mode, compact),
    [sections, width, mode, compact],
  );
  const ready = width > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const plate = plateRef.current;
    if (!ready || !canvas || !plate) return;
    const root = plate.closest<HTMLElement>(".fx-draft") ?? plate;
    const ink = new Ink(canvas, plate, root);
    if (!ink.ok) setBare(true);
    inkRef.current = ink;
    plotted.current = null;
    return () => {
      ink.dispose();
      inkRef.current = null;
    };
  }, [ready]);
  useEffect(() => {
    inkRef.current?.setOptions({ developAll, reduced, paused, filtered });
  }, [ready, developAll, reduced, paused, filtered]);
  useEffect(() => {
    const ink = inkRef.current;
    if (!ink) return;
    const was = plotted.current;
    const how = !was
      ? "intro"
      : was.sections !== sections || was.mode !== mode
        ? "sweep"
        : "none";
    plotted.current = { sections, mode };
    ink.setPlan(pl, how);
  }, [ready, pl, sections, mode]);
  useEffect(() => {
    inkRef.current?.setLamp(lamp);
  }, [ready, lamp]);

  // A hovered book that is no longer on the plan is dropped.
  const hotSlot = hot ? pl.slots.find((s) => s.book.id === hot.id) : undefined;

  const show = (el: HTMLElement, focus: boolean) => {
    const s = pl.slots[Number(el.dataset.i)];
    if (!s) return;
    const rect = el.getBoundingClientRect();
    setHot((h) =>
      h?.id === s.book.id ? h : { id: s.book.id, below: rect.top < 250 },
    );
    warmNote(s.book.id);
    if (focus) inkRef.current?.pulse(s.x + s.w / 2, s.y + s.h / 2, s.h * 1.15);
  };

  const plateXY = (e: { clientX: number; clientY: number }) => {
    const r = plateRef.current?.getBoundingClientRect();
    return r
      ? { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }
      : null;
  };
  const lampHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { on: true, moved: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag.current.on) return;
      if (!drag.current.moved && Math.hypot(e.movementX, e.movementY) < 1)
        return;
      const at = plateXY(e);
      if (!at) return;
      drag.current.moved = true;
      setDragging(true);
      setLamp({ x: at.x, y: at.y });
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!drag.current.on) return;
      drag.current.on = false;
      setDragging(false);
      const at = plateXY(e);
      if (!drag.current.moved || !at) return;
      const offSheet =
        at.x < -30 || at.x > at.w + 30 || at.y < -30 || at.y > at.h + 30;
      setLamp(
        offSheet
          ? null
          : {
              x: Math.min(at.w, Math.max(0, at.x)),
              y: Math.min(at.h, Math.max(0, at.y)),
            },
      );
    },
    onPointerCancel: () => {
      drag.current.on = false;
      setDragging(false);
    },
  };
  // A click without a drag (and Enter or Space) toggles the lamp.
  const lampClick = () => {
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    if (lamp) return setLamp(null);
    const r = plateRef.current?.getBoundingClientRect();
    if (!r) return;
    const top = Math.max(0, -r.top);
    const bottom = Math.min(r.height, window.innerHeight - r.top);
    setLamp({ x: r.width / 2, y: (top + Math.max(top, bottom)) / 2 });
  };
  const lampKey = (e: React.KeyboardEvent) => {
    if (!lamp) return;
    const step = e.shiftKey ? 80 : 24;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = d[e.key];
    if (move) {
      e.preventDefault();
      setLamp({
        x: Math.min(pl.width, Math.max(0, lamp.x + move[0])),
        y: Math.min(pl.height, Math.max(0, lamp.y + move[1])),
      });
    } else if (e.key === "Escape" || e.key === "Delete") setLamp(null);
  };

  return (
    <div className="plate-w" ref={wrapRef}>
      {ready && (
        <div
          ref={plateRef}
          className={
            "plate " +
            mode +
            (filtered ? " filtered" : "") +
            (bare ? " bare" : "")
          }
          style={{ height: pl.height }}
          onPointerOver={(e) => {
            if (e.pointerType === "touch") return;
            const el = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-i]",
            );
            if (el) show(el, false);
            else setHot(null);
          }}
          onPointerLeave={() => setHot(null)}
          onFocus={(e) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-i]",
            );
            if (el) show(el, true);
          }}
          onBlur={() => setHot(null)}
          onClick={(e) => {
            const el = (e.target as HTMLElement).closest<HTMLElement>(
              "[data-book]",
            );
            if (el?.dataset.book) onOpen(el.dataset.book);
          }}
        >
          <div className="real">
            {pl.rows.map((r) => (
              <div
                key={r.n}
                className={"case" + (r.live ? "" : " off")}
                style={{ top: r.top, height: r.base - r.top + r.board }}
              >
                <i style={{ height: r.board }} />
              </div>
            ))}
            {pl.slots.map((s) => (
              <Vol
                key={s.book.id}
                s={s}
                mode={mode}
                hot={hotSlot === s}
                out={openId === s.book.id}
              />
            ))}
          </div>
          <canvas ref={canvasRef} className="ink" aria-hidden="true" />
          {pl.heads.map((h) => (
            <div
              key={h.key}
              className={"head" + (h.live ? "" : " off")}
              style={{ top: h.y }}
            >
              <span className="head-tag">{h.tag}</span>
              <h2>{h.title}</h2>
              <span className="head-note">{h.note}</span>
            </div>
          ))}
          {empty}
          {hotSlot && openId !== hotSlot.book.id && (
            <>
              <Lift
                key={"l" + hotSlot.book.id}
                s={hotSlot}
                mode={mode}
                width={pl.width}
              />
              <Callout
                key={"c" + hotSlot.book.id}
                s={hotSlot}
                below={hot?.below ?? false}
                width={pl.width}
                total={total}
                compact={compact}
              />
            </>
          )}
          {lamp && (
            <button
              type="button"
              className={"lamp set" + (dragging ? " drag" : "")}
              style={{ left: lamp.x, top: lamp.y }}
              aria-label="Fixed lamp. Arrow keys move it. Press Enter to return it to the corner."
              onClick={(e) => {
                e.stopPropagation();
                lampClick();
              }}
              onKeyDown={lampKey}
              {...lampHandlers}
            >
              <Compass />
            </button>
          )}
        </div>
      )}
      <div className={"dock" + (lamp ? " empty" : "")}>
        <button
          type="button"
          className="lamp"
          aria-label={
            lamp
              ? "Return the lamp to the corner"
              : "Lamp. Drag it onto the sheet, or press Enter, to fix a light there."
          }
          aria-pressed={Boolean(lamp)}
          onClick={lampClick}
          {...lampHandlers}
        >
          <Compass />
        </button>
        <span aria-hidden="true">{lamp ? "Lamp set" : "Lamp"}</span>
      </div>
    </div>
  );
}
