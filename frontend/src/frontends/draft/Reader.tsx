// The reader: a book taken off the sheet. Its outline detaches from the shelf,
// fills with colour and flies to the centre as a full 3D hardcover, with an
// exploded drawing of its parts behind and its synopsis set as a
// specification block beneath.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import { focuses, useNote } from "../../shared/catalogue";
import { letters, maxDepth, type Entry, type Mode } from "./layout";
import { DepthBar, Glyph } from "./Sheet";

type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const path = (...pts: V[]) =>
  "M" +
  pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L") +
  " Z";
// Three visible faces of an oblique box: face a x b at o, its top and its side.
function box(o: V, a: V, b: V, c: V) {
  const oa = add(o, a);
  const ob = add(o, b);
  const oab = add(oa, b);
  return [
    path(ob, oab, add(oab, c), add(ob, c)),
    path(oa, add(oa, c), add(oab, c), oab),
    path(o, oa, oab, ob),
  ];
}

function Exploded({ e, compact }: { e: Entry; compact: boolean }) {
  const W = compact ? 360 : 980;
  const H = compact ? 340 : 500;
  const C: V = [W / 2, H / 2];
  const ph = (compact ? 84 : 170) * e.art.heightScale;
  const pw = ph * 0.66;
  const pd = Math.max(4, (e.art.depth * (compact ? 84 : 170)) / 190);
  const u: V = [0.5, 0.24];
  const n: V = [0.92, -0.38];
  const a = mul(u, pw);
  const b: V = [0, -ph];
  const at = (dist: number): V => {
    const c = add(C, mul(n, dist));
    return [c[0] - a[0] / 2, c[1] - a[1] / 2 + ph / 2];
  };
  const d = compact ? [-150, 116, 160] : [-300, 205, 330];
  const oFront = at(d[0]);
  const oBlock = at(d[1]);
  const oBack = at(d[2] + pd * 0.5);
  const oSpine = add(oBlock, mul(u, compact ? -16 : -36));
  const mid = (o: V, ax: V, bx: V): V =>
    add(o, add(mul(ax, 0.5), mul(bx, 0.5)));
  const board = compact ? 2 : 4;
  const parts = [
    {
      key: "A",
      name: "Front board",
      data: "Jacket face",
      faces: box(oFront, a, b, mul(n, board)),
      p: mid(oFront, a, b),
      off: [-70, -128] as V,
    },
    {
      key: "B",
      name: "Spine",
      data: "Depth " + Math.min(1, e.art.depth / maxDepth).toFixed(2) + " rel.",
      faces: box(oSpine, mul(u, compact ? 1.5 : 3), b, mul(n, pd)),
      p: add(add(oSpine, mul(n, pd * 0.5)), mul(b, 0.3)),
      off: [26, 150] as V,
    },
    {
      key: "C",
      name: "Text block",
      data: e.art.pages ? e.art.pages + " pp." : "pp. not recorded",
      faces: box(
        add(oBlock, [1.5, -3]),
        mul(a, 0.95),
        mul(b, 0.955),
        mul(n, pd),
      ),
      p: mid(oBlock, a, mul(b, 1.5)),
      off: [-16, -108] as V,
    },
    {
      key: "D",
      name: "Back board",
      data: "Cloth " + e.art.cloth.toUpperCase(),
      faces: box(oBack, a, b, mul(n, board)),
      p: mid(oBack, a, mul(b, 0.5)),
      off: [44, 118] as V,
    },
  ];
  const ax0 = add(C, mul(n, compact ? -176 : -400));
  const ax1 = add(C, mul(n, compact ? 196 : 430));
  return (
    <svg
      className="rd-exploded"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <line
        className="x-axis"
        x1={ax0[0]}
        y1={ax0[1]}
        x2={ax1[0]}
        y2={ax1[1]}
      />
      {[parts[3], parts[2], parts[1], parts[0]].map((part, k) => (
        <g
          key={part.key}
          className="x-part"
          style={{ "--k": k } as CSSProperties}
        >
          {part.faces.map((f, i) => (
            <path key={i} d={f} pathLength={1} />
          ))}
          {part.key === "C" &&
            [0.25, 0.5, 0.75].map((t) => {
              const s = add(add(oBlock, [1.5, -3]), mul(a, 0.95));
              const from = add(s, mul(n, pd * t));
              return (
                <line
                  key={t}
                  className="x-leaf"
                  x1={from[0]}
                  y1={from[1]}
                  x2={from[0]}
                  y2={from[1] - ph * 0.955}
                />
              );
            })}
        </g>
      ))}
      {parts.map((part, k) => {
        const off = compact
          ? ([part.off[0] > 0 ? 12 : -12, part.off[1] > 0 ? 60 : -60] as V)
          : part.off;
        const l = add(part.p, off);
        const right = off[0] > 0;
        return (
          <g
            key={part.key}
            className="x-label"
            style={{ "--k": k } as CSSProperties}
          >
            <polyline
              points={`${part.p[0]},${part.p[1]} ${l[0]},${l[1]} ${l[0] + (right ? 14 : -14)},${l[1]}`}
            />
            <circle cx={part.p[0]} cy={part.p[1]} r="2.2" />
            {compact ? (
              <text
                x={l[0] + (right ? 18 : -18)}
                y={l[1] + 3.5}
                textAnchor={right ? "start" : "end"}
              >
                {part.key}
              </text>
            ) : (
              <text
                x={l[0] + (right ? 20 : -20)}
                y={l[1] - 3}
                textAnchor={right ? "start" : "end"}
              >
                <tspan className="x-key">{part.key}</tspan>
                {"  " + part.name}
                <tspan x={l[0] + (right ? 20 : -20)} dy="14" className="x-data">
                  {part.data}
                </tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const REST = { rx: -8, ry: 28 };
const POSES = [28, 90, 152, 208, 270, 332];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

type Flight = {
  t0: number;
  dur: number;
  dir: 1 | -1;
  dx: number;
  dy: number;
  s: number;
  ry: number;
  rx: number;
  to: { rx: number; ry: number };
  done?: () => void;
};

export function Reader({
  entry,
  total,
  closing,
  mode,
  reduced,
  compact,
  origin,
  onClose,
  onClosed,
  onStep,
}: {
  entry: Entry;
  total: number;
  closing: boolean;
  mode: Mode;
  reduced: boolean;
  compact: boolean;
  origin: (id: string) => DOMRect | null;
  onClose: () => void;
  onClosed: () => void;
  onStep: (by: number) => void;
}) {
  const { book, art } = entry;
  const { note, state, retry } = useNote(book.id);
  const [opened, setOpened] = useState(false);
  const [more, setMore] = useState(false);
  const [aspect, setAspect] = useState(0.66);
  const [ghost, setGhost] = useState<DOMRect | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const fly = useRef<HTMLDivElement>(null);
  const turn = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);
  openedRef.current = opened;
  const sim = useRef({
    rx: REST.rx,
    ry: REST.ry,
    vx: 0,
    vy: 0,
    dragging: false,
    target: { ...REST } as { rx: number; ry: number } | null,
    flight: null as Flight | null,
    raf: 0,
    last: 0,
    moved: 0,
    lx: 0,
    ly: 0,
    lt: 0,
  });

  const base = compact ? 236 : 330;
  const bh = Math.round(base * art.heightScale);
  const bw = Math.round(bh * aspect);
  const bd = Math.max(10, Math.round((art.depth * base) / 190));

  const paint = (dx = 0, dy = 0, s = 1, alpha = 1) => {
    const m = sim.current;
    if (turn.current)
      turn.current.style.transform = `rotateX(${m.rx.toFixed(2)}deg) rotateY(${m.ry.toFixed(2)}deg)`;
    if (fly.current) {
      fly.current.style.transform = `translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) scale(${s.toFixed(4)})`;
      fly.current.style.opacity = String(alpha);
    }
  };
  const step = (now: number) => {
    const m = sim.current;
    m.raf = 0;
    const dt = clamp((now - m.last) / 1000, 0.001, 0.05);
    m.last = now;
    let busy = false;
    const f = m.flight;
    if (f) {
      const t = clamp((now - f.t0) / f.dur);
      // k runs 0 on the shelf to 1 at rest in the reader.
      const k =
        f.dir > 0
          ? 1 - Math.pow(1 - t, 3.4)
          : 1 - (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      m.ry = f.ry + (f.to.ry - f.ry) * k;
      m.rx = f.rx + (f.to.rx - f.rx) * k;
      paint(
        f.dx * (1 - k),
        f.dy * (1 - k) - Math.sin(Math.PI * k) * 46,
        f.s + (1 - f.s) * k,
        clamp(k * 6),
      );
      if (t >= 1) {
        m.flight = null;
        f.done?.();
      }
      busy = true;
    } else if (!m.dragging) {
      if (Math.abs(m.vx) + Math.abs(m.vy) > 14) {
        m.ry += m.vy * dt;
        m.rx = clamp(m.rx + m.vx * dt, -70, 70);
        const drag = Math.pow(0.045, dt);
        m.vx *= drag;
        m.vy *= drag;
        busy = true;
      } else {
        m.vx = m.vy = 0;
        if (!m.target) {
          const turns = Math.floor(m.ry / 360) * 360;
          const local = m.ry - turns;
          const near = openedRef.current
            ? 14
            : [...POSES, POSES[0] + 360, POSES[5] - 360].reduce((best, p) =>
                Math.abs(p - local) < Math.abs(best - local) ? p : best,
              );
          m.target = openedRef.current
            ? { rx: -6, ry: Math.round(m.ry / 360) * 360 + near }
            : { rx: REST.rx, ry: turns + near };
        }
        const ease = Math.min(1, dt * 5.5);
        m.ry += (m.target.ry - m.ry) * ease;
        m.rx += (m.target.rx - m.rx) * ease;
        busy =
          Math.abs(m.target.ry - m.ry) + Math.abs(m.target.rx - m.rx) > 0.08;
      }
      paint();
    } else {
      paint();
      busy = true;
    }
    if (busy) m.raf = requestAnimationFrame(step);
  };
  const run = () => {
    const m = sim.current;
    if (!m.raf) {
      m.last = performance.now();
      m.raf = requestAnimationFrame(step);
    }
  };

  // Flight out of the shelf on mount.
  useLayoutEffect(() => {
    const m = sim.current;
    const from = reduced ? null : origin(book.id);
    const home = slot.current?.getBoundingClientRect();
    if (from && home) {
      m.flight = {
        t0: performance.now(),
        dur: 980,
        dir: 1,
        dx: from.left + from.width / 2 - (home.left + home.width / 2),
        dy: from.top + from.height / 2 - (home.top + home.height / 2),
        s: from.height / Math.max(1, home.height),
        ry: mode === "spines" ? 90 : 0,
        rx: 0,
        to: { ...REST },
      };
      m.ry = m.flight.ry;
      m.rx = 0;
      paint(m.flight.dx, m.flight.dy, m.flight.s, 0);
      setGhost(from);
      run();
    } else paint();
    turn.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(m.raf);
      m.raf = 0;
    };
    // Mount only: stepping to another book is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Another book in the same reader: reset the pose, no flight.
  const shown = useRef(book.id);
  useEffect(() => {
    if (shown.current === book.id) return;
    shown.current = book.id;
    const m = sim.current;
    m.flight = null;
    m.vx = m.vy = 0;
    m.rx = REST.rx;
    m.ry = reduced ? REST.ry : REST.ry - 70;
    m.target = { ...REST };
    setOpened(false);
    setMore(false);
    setAspect(0.66);
    setGhost(null);
    paint();
    run();
    if (dialog.current) dialog.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // Fold back into the line.
  useEffect(() => {
    if (!closing) return;
    setOpened(false);
    const m = sim.current;
    const to = reduced ? null : origin(book.id);
    const home = slot.current?.getBoundingClientRect();
    if (!to || !home) {
      const id = window.setTimeout(onClosed, reduced ? 0 : 240);
      return () => window.clearTimeout(id);
    }
    m.vx = m.vy = 0;
    m.flight = {
      t0: performance.now(),
      dur: 620,
      dir: -1,
      dx: to.left + to.width / 2 - (home.left + home.width / 2),
      dy: to.top + to.height / 2 - (home.top + home.height / 2),
      s: to.height / Math.max(1, home.height),
      ry:
        Math.round((m.ry - (mode === "spines" ? 90 : 0)) / 360) * 360 +
        (mode === "spines" ? 90 : 0),
      rx: 0,
      to: { rx: m.rx, ry: m.ry },
      done: onClosed,
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  // Opening or closing the cover re-settles the pose.
  useEffect(() => {
    const m = sim.current;
    if (m.flight) return;
    m.target = null;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = sim.current;
    if (m.flight) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    m.dragging = true;
    m.moved = 0;
    m.vx = m.vy = 0;
    m.lx = e.clientX;
    m.ly = e.clientY;
    m.lt = performance.now();
    run();
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const m = sim.current;
    if (!m.dragging) return;
    const dx = e.clientX - m.lx;
    const dy = e.clientY - m.ly;
    const now = performance.now();
    const dt = Math.max(0.008, (now - m.lt) / 1000);
    m.lx = e.clientX;
    m.ly = e.clientY;
    m.lt = now;
    m.moved += Math.abs(dx) + Math.abs(dy);
    m.ry += dx * 0.5;
    m.rx = clamp(m.rx - dy * 0.36, -70, 70);
    m.vy = m.vy * 0.5 + ((dx * 0.5) / dt) * 0.5;
    m.vx = m.vx * 0.5 + ((-dy * 0.36) / dt) * 0.5;
  };
  const up = () => {
    const m = sim.current;
    if (!m.dragging) return;
    m.dragging = false;
    if (performance.now() - m.lt > 90) m.vx = m.vy = 0;
    if (m.moved < 7) {
      m.vx = m.vy = 0;
      setOpened((o) => !o);
    }
    m.target = null;
    run();
  };
  const bookKey = (e: React.KeyboardEvent) => {
    const m = sim.current;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [0, -30],
      ArrowRight: [0, 30],
      ArrowUp: [12, 0],
      ArrowDown: [-12, 0],
    };
    const by = d[e.key];
    if (by) {
      e.preventDefault();
      e.stopPropagation();
      const from = m.target ?? { rx: m.rx, ry: m.ry };
      m.vx = m.vy = 0;
      m.target = { rx: clamp(from.rx + by[0], -60, 60), ry: from.ry + by[1] };
      run();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpened((o) => !o);
    }
  };
  const dialogKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if ((e.target as HTMLElement).closest("a,input,textarea")) return;
      e.preventDefault();
      onStep(e.key === "ArrowLeft" ? -1 : 1);
    } else if (e.key === "Tab" && dialog.current) {
      const items = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],[tabindex="0"]',
        ),
      ];
      if (!items.length) return;
      const first = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (
        e.shiftKey &&
        (active === first || !dialog.current.contains(active))
      ) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const cat = entry.cat;
  const hasMore = Boolean(
    note && (note.synopsis || note.author || note.source),
  );
  const titleId = "fx-draft-reader-title";
  return (
    <div
      ref={dialog}
      className={
        "rd" + (closing ? " closing" : "") + (compact ? " compact" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={dialogKey}
    >
      {ghost && !closing && (
        <span
          className="rd-ghost"
          aria-hidden="true"
          style={{
            left: ghost.left,
            top: ghost.top,
            width: ghost.width,
            height: ghost.height,
          }}
        />
      )}
      <div className="rd-in">
        <div className="rd-top">
          <span className="rd-tag">
            Detail <b>Vol. {String(entry.no).padStart(3, "0")}</b> of {total}
          </span>
          <span className="rd-nav">
            <button
              type="button"
              onClick={() => onStep(-1)}
              aria-label="Previous book"
            >
              <ArrowLeft size={16} strokeWidth={1.4} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onStep(1)}
              aria-label="Next book"
            >
              <ArrowRight size={16} strokeWidth={1.4} aria-hidden="true" />
            </button>
            <button type="button" className="rd-x" onClick={onClose}>
              <X size={16} strokeWidth={1.4} aria-hidden="true" />
              <span>Return to sheet</span>
            </button>
          </span>
        </div>

        <div className="rd-stage" style={{ height: compact ? 340 : 500 }}>
          <Exploded key={book.id} e={entry} compact={compact} />
          <div ref={slot} className="rd-slot" style={{ width: bw, height: bh }}>
            <div ref={fly} className="rd-fly">
              <div
                ref={turn}
                className={"rd-book" + (opened ? " open" : "")}
                tabIndex={0}
                role="button"
                aria-pressed={opened}
                aria-label={
                  "Jacket of " +
                  art.title +
                  ". Drag or use the arrow keys to turn it. Press Enter to " +
                  (opened ? "close" : "open") +
                  " the cover."
                }
                style={
                  {
                    "--d": bd + "px",
                    "--cloth": art.cloth,
                    width: bw,
                    height: bh,
                  } as CSSProperties
                }
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onKeyDown={bookKey}
              >
                <span className="b b-back" />
                <span className="b b-fore" />
                <span className="b b-head" />
                <span className="b b-foot" />
                <span className="b b-spine">
                  {art.spine ? (
                    <img src={art.spine} alt="" draggable={false} />
                  ) : (
                    <em>{art.title}</em>
                  )}
                </span>
                <span className="b b-leaf">
                  <strong>{art.title}</strong>
                  <i />
                  <span>{book.author}</span>
                </span>
                <span className="b b-front">
                  <span className="b-out">
                    {art.front ? (
                      <img
                        key={art.front}
                        src={art.front}
                        alt=""
                        draggable={false}
                        onLoad={(e) => {
                          const im = e.currentTarget;
                          if (im.naturalWidth && im.naturalHeight)
                            setAspect(
                              clamp(
                                im.naturalWidth / im.naturalHeight,
                                0.56,
                                0.82,
                              ),
                            );
                        }}
                      />
                    ) : (
                      <em>{art.title}</em>
                    )}
                  </span>
                  <span className="b-in" />
                </span>
              </div>
            </div>
          </div>
          <p className="rd-hint" aria-hidden="true">
            Drag to turn <i />{" "}
            {opened ? "Tap to close the cover" : "Tap to open the cover"}
          </p>
        </div>

        <dl className="rd-parts">
          <div>
            <dt>A</dt>
            <dd>Front board</dd>
          </div>
          <div>
            <dt>B</dt>
            <dd>
              Spine, depth {Math.min(1, art.depth / maxDepth).toFixed(2)} rel.
            </dd>
          </div>
          <div>
            <dt>C</dt>
            <dd>
              Text block, {art.pages ? art.pages + " pp." : "pp. not recorded"}
            </dd>
          </div>
          <div>
            <dt>D</dt>
            <dd>Back board, cloth {art.cloth.toUpperCase()}</dd>
          </div>
        </dl>

        <section className="rd-spec" key={book.id}>
          <div className="sp-head" aria-hidden="true">
            <span>Specification</span>
            <span>Sheet {mode === "spines" ? "01" : "02"}</span>
          </div>
          <div className="sp-row sp-title">
            <span className="sp-k">Title</span>
            <h2 id={titleId}>{art.title}</h2>
          </div>
          <div className="sp-row">
            <span className="sp-k">Author</span>
            <p className="sp-author">{book.author}</p>
          </div>
          <div className="sp-row">
            <span className="sp-k">Synopsis</span>
            <div className="sp-v">
              {state === "loading" && (
                <p className="sp-wait" role="status">
                  Retrieving the synopsis
                </p>
              )}
              {state === "error" && (
                <p role="alert">
                  The synopsis did not load.{" "}
                  <button type="button" className="sp-link" onClick={retry}>
                    Try again
                  </button>
                </p>
              )}
              {state === "ok" && note === null && <p>No synopsis yet.</p>}
              {state === "ok" && note && (
                <>
                  <p className="sp-brief">{note.brief}</p>
                  {more && (
                    <div className="sp-more">
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
                        <p>
                          <a
                            href={note.source}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source
                            <ArrowUpRight
                              size={13}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                  {hasMore && (
                    <button
                      type="button"
                      className="sp-link"
                      aria-expanded={more}
                      onClick={() => setMore((v) => !v)}
                    >
                      {more ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="sp-row">
            <span className="sp-k">Category</span>
            <p className="sp-cat">
              <Glyph cat={cat} /> {focuses[cat]}
              <span>Elevation {letters[cat]}</span>
            </p>
          </div>
          <div className="sp-row">
            <span className="sp-k">Spine</span>
            <p className="sp-cat">
              <DepthBar depth={art.depth} />
              <span>against the thickest on the shelf</span>
            </p>
          </div>
          {((art.pages && art.edition) || art.custom) && (
            <div className="sp-row">
              <span className="sp-k">Edition</span>
              <p className="sp-ed">
                {art.pages && art.edition && (
                  <a href={art.edition} target="_blank" rel="noreferrer">
                    {art.pages} pages · {art.editionLabel}
                    <ArrowUpRight
                      size={13}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </a>
                )}
                {art.custom && <small>Custom library jacket</small>}
              </p>
            </div>
          )}
        </section>
        <div className="rd-foot">
          <button type="button" onClick={() => onStep(-1)}>
            <ArrowLeft size={14} strokeWidth={1.4} aria-hidden="true" />{" "}
            Previous
          </button>
          <button type="button" onClick={onClose}>
            Fold back into the sheet
          </button>
          <button type="button" onClick={() => onStep(1)}>
            Next <ArrowRight size={14} strokeWidth={1.4} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
