// The optical bench: a sideways journey driven by ordinary vertical
// scrolling. A canvas paints light under and around DOM books.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";
import { focuses } from "../../shared/catalogue";
import { site } from "../../shared/site";
import { draw, landing, type Scene } from "./draw";
import {
  RAYS,
  WAVELENGTHS,
  clamp,
  measure,
  place,
  targets,
  thetaRange,
  type Item,
  type Layout,
  type Shelf,
} from "./layout";
import { DEG, prismVerts, solveRay, type RayPath } from "./optics";
import ShelfBook from "./ShelfBook";

export type BenchApi = {
  toStart: () => void;
  rectOf: (id: string) => DOMRect | null;
  focusBook: (id: string) => void;
};

type Props = {
  state: "loading" | "ok" | "error";
  reload: () => void;
  order: Item[][]; // four shelves, already sorted, matches first
  matches: Set<string> | null;
  total: number;
  focus: number; // -1 for all
  pair: number; // phones: which two shelves show, 0 or 1
  layout: Layout;
  byColour: boolean;
  awayId: string | null;
  paused: boolean;
  reduce: boolean;
  pages: { sum: number; known: number };
  api: RefObject<BenchApi | null>;
  onOpen: (id: string) => void;
};

const BUCKET = 180;

export default function Bench(props: Props) {
  const { state, order, matches, focus, layout, reduce, paused } = props;
  const viewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<HTMLSpanElement>(null);
  const hotRef = useRef<HTMLSpanElement>(null);
  const indexRef = useRef<HTMLSpanElement>(null);
  const shelfEls = useRef<(HTMLDivElement | null)[]>([]);
  const labelEls = useRef<(HTMLDivElement | null)[]>([]);
  const leanEls = useRef<(HTMLDivElement | null)[]>([]);

  const [size, setSize] = useState(() => ({
    vw: typeof window === "undefined" ? 1280 : window.innerWidth,
    vh: typeof window === "undefined" ? 800 : window.innerHeight,
  }));
  const m = useMemo(() => measure(size.vw, size.vh), [size]);
  const [theta, setTheta] = useState(m.theta0);
  const pair = props.pair;
  const [bucket, setBucket] = useState(0);
  const [noCanvas, setNoCanvas] = useState(false);
  const ready = state === "ok";

  // Reset the prism when the bench changes between phone and desk geometry.
  useEffect(() => setTheta(m.theta0), [m.theta0]);

  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const read = () =>
      setSize((s) =>
        s.vw === el.clientWidth && s.vh === el.clientHeight
          ? s
          : { vw: el.clientWidth, vh: el.clientHeight },
      );
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tg = useMemo(
    () => targets(m, focus, pair, theta),
    [m, focus, pair, theta],
  );
  const shelves: Shelf[] = useMemo(
    () =>
      order.map((items, index) => ({
        index,
        ...place(items, layout, m.h0, matches),
      })),
    [order, layout, m.h0, matches],
  );

  const world = useMemo(() => {
    let reach = 0;
    shelves.forEach((sh) => {
      if (tg.shown[sh.index]) reach = Math.max(reach, sh.len * tg.s[sh.index]);
    });
    const end = m.xs + (reach > 0 ? reach + 70 : 260);
    const x2 = end + m.fan;
    const verts = prismVerts(m.px, tg.pcy, m.r, m.theta0);
    const d = { x: Math.cos(m.beta), y: -Math.sin(m.beta) };
    const probe = solveRay(
      { x: m.px - d.x * 3000, y: tg.pcy - d.y * 3000 },
      d,
      verts,
      m.xs,
      tg.pcy,
    );
    const land = landing(m, probe.entry, x2, m.vh - m.railH);
    const width = ready
      ? Math.round(
          Math.max(x2 + m.vw * 0.6, land.x + (m.phone ? m.vw - 60 : 620)),
        )
      : m.vw;
    return { end, x2, land, width };
  }, [shelves, tg, m, ready]);

  // Everything the frame loop reads, kept current without restarting it.
  const live = useRef({
    m,
    tg,
    shelves,
    world,
    theta,
    matches,
    focus,
    ready,
    version: 0,
  });
  live.current = {
    m,
    tg,
    shelves,
    world,
    theta,
    matches,
    focus,
    ready,
    version: live.current.version + 1,
  };

  // Shelves that have just mounted take their place before the first paint;
  // after that the frame loop owns their transform.
  useLayoutEffect(() => {
    for (let i = 0; i < 4; i++) {
      const el = shelfEls.current[i];
      if (el && !el.style.transform) {
        el.style.transform = `translate3d(0,${tg.y[i]}px,0) scale(${tg.s[i]})`;
        el.style.opacity = tg.shown[i] ? "1" : "0";
      }
      const lab = labelEls.current[i];
      if (lab && !lab.style.transform)
        lab.style.transform = `scale(${1 / tg.s[i]})`;
    }
  });

  const dragged = useRef(false);
  // The fan opens once the books are here and the beam has reached the
  // prism. Decided during render so the books never flash before rising.
  const clock = useRef({ born: 0, fanAt: 0 });
  const [fanStart, setFanStart] = useState<{ at: number; base: number } | null>(
    null,
  );
  const [introDone, setIntroDone] = useState(false);
  if (ready && !fanStart) {
    const now = performance.now();
    const born = clock.current.born || now;
    // Arriving on a book link, or part way along: the bench is already lit.
    const still = reduce || paused || window.scrollY > 40;
    if (still) clock.current.born = now - 5000;
    const at = still ? now - 5000 : Math.max(now, born + 900);
    setFanStart({ at, base: still ? -1 : (at - now) / 1000 });
  }
  if (fanStart) clock.current.fanAt = fanStart.at;
  const intro = fanStart && fanStart.base >= 0 && !introDone ? fanStart : null;
  useEffect(() => {
    if (!fanStart || fanStart.base < 0) return;
    const done = window.setTimeout(
      () => setIntroDone(true),
      fanStart.base * 1000 + 2700,
    );
    return () => window.clearTimeout(done);
  }, [fanStart]);

  // The frame loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext("2d") : null;
    if (!canvas || !ctx) {
      setNoCanvas(true);
    }
    const now0 = performance.now();
    if (!clock.current.born) clock.current.born = now0;
    const cam = { x: window.scrollY, fling: 0 };
    const anim = {
      y: live.current.tg.y.slice(),
      s: live.current.tg.s.slice(),
      w: live.current.tg.shown.map((v) => (v ? 1 : 0)),
      boost: [0, 0, 0, 0],
      theta: live.current.theta,
    };
    const pointer = { x: 0, y: 0, on: false };
    let raf = 0;
    let last = now0;
    let seen = "";
    let lastBucket = -1;
    let lastN = "";
    let lastPos = "";
    let dpr = 1;
    let cw = 0;
    let ch = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const L = live.current;
      const { m, tg, world } = L;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const ease = (rate: number) => (reduce ? 1 : 1 - Math.exp(-dt * rate));

      // Camera follows the page scroll with a little inertia.
      const max = Math.max(0, world.width - m.vw);
      if (Math.abs(cam.fling) > 0.4 && !reduce) {
        window.scrollBy(0, cam.fling);
        cam.fling *= Math.pow(0.93, dt * 60);
      } else cam.fling = 0;
      const want = clamp(window.scrollY, 0, max);
      cam.x += (want - cam.x) * ease(9);
      if (Math.abs(want - cam.x) < 0.05) cam.x = want;
      const vel = want - cam.x;

      let moving = false;
      for (let i = 0; i < 4; i++) {
        const wt = tg.shown[i] ? 1 : 0;
        const hits = L.matches ? (L.shelves[i].hits > 0 ? 1 : -0.55) : 0;
        if (
          Math.abs(tg.y[i] - anim.y[i]) > 0.1 ||
          Math.abs(tg.s[i] - anim.s[i]) > 0.001 ||
          Math.abs(wt - anim.w[i]) > 0.004 ||
          Math.abs(hits - anim.boost[i]) > 0.004
        )
          moving = true;
        anim.y[i] += (tg.y[i] - anim.y[i]) * ease(7);
        anim.s[i] += (tg.s[i] - anim.s[i]) * ease(7);
        anim.w[i] += (wt - anim.w[i]) * ease(6);
        anim.boost[i] += (hits - anim.boost[i]) * ease(5);
      }
      if (!moving)
        for (let i = 0; i < 4; i++) {
          anim.y[i] = tg.y[i];
          anim.s[i] = tg.s[i];
        }
      anim.theta = L.theta;

      // Entrance timing.
      const c = clock.current;
      const beam = reduce ? 1 : clamp((now - c.born) / 900, 0, 1);
      const fanP = !L.ready
        ? 0
        : reduce || !c.fanAt
          ? c.fanAt || reduce
            ? 1
            : 0
          : clamp((now - c.fanAt) / 1500, 0, 1);

      // Trace the four rays for this instant.
      const verts = prismVerts(m.px, tg.pcy, m.r, anim.theta);
      const d = { x: Math.cos(m.beta), y: -Math.sin(m.beta) };
      const o = { x: m.px - d.x * 3000, y: tg.pcy - d.y * 3000 };
      const rays: RayPath[] = [];
      for (let i = 0; i < 4; i++)
        rays.push(solveRay(o, d, verts, m.xs, anim.y[i]));

      // Move the DOM to match.
      const track = trackRef.current;
      if (track) track.style.transform = `translate3d(${-cam.x}px,0,0)`;
      const paper = paperRef.current;
      if (paper)
        paper.style.backgroundPosition = `${-cam.x * 0.35}px 0, ${-cam.x * 0.35}px 0, ${-cam.x * 0.62}px 0, ${-cam.x * 0.62}px 0`;
      const lean = reduce ? 0 : clamp(vel * 0.018, -5, 5);
      for (let i = 0; i < 4; i++) {
        const el = shelfEls.current[i];
        if (el) {
          el.style.transform = `translate3d(0,${anim.y[i]}px,0) scale(${anim.s[i]})`;
          el.style.opacity = String(clamp(anim.w[i] * 1.4 - 0.2, 0, 1));
          el.style.setProperty("--inv", String(1 / anim.s[i]));
        }
        const lab = labelEls.current[i];
        if (lab) {
          const stick = clamp(
            cam.x + (m.phone ? 12 : 22) - m.xs,
            0,
            Math.max(0, world.end - m.xs - 260),
          );
          lab.style.transform = `translate3d(${stick / anim.s[i]}px,0,0) scale(${1 / anim.s[i]})`;
        }
        const ln = leanEls.current[i];
        if (ln) ln.style.transform = lean ? `skewX(${-lean}deg)` : "";
      }
      const b = Math.round(cam.x / BUCKET);
      if (b !== lastBucket) {
        lastBucket = b;
        setBucket(b);
      }
      const n = rays
        .map((r) => (r.solved ? r.n.toFixed(2) : "open"))
        .join("  ");
      if (n !== lastN && indexRef.current) {
        lastN = n;
        indexRef.current.textContent = n;
      }
      const span = Math.max(1, world.end - m.xs);
      const pos =
        String(
          Math.round(clamp(cam.x + m.vw / 2 - m.xs, 0, span) / 10),
        ).padStart(4, "0") +
        " / " +
        Math.round(span / 10);
      if (pos !== lastPos && posRef.current) {
        lastPos = pos;
        posRef.current.textContent = pos;
      }

      if (!ctx || !canvas) return;
      const wantDpr = Math.min(window.devicePixelRatio || 1, m.phone ? 1.5 : 2);
      if (cw !== m.vw || ch !== m.vh || dpr !== wantDpr) {
        cw = m.vw;
        ch = m.vh;
        dpr = wantDpr;
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
        seen = "";
      }
      const shimmer = !reduce && !m.phone;
      const sig = shimmer
        ? ""
        : [
            cam.x.toFixed(1),
            moving,
            beam,
            fanP,
            pointer.x,
            pointer.y,
            L.version,
            anim.theta,
          ].join("|");
      if (!shimmer && sig === seen && !moving) return;
      seen = sig;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const scene: Scene = {
        ctx,
        w: cw,
        h: ch,
        m,
        cam: cam.x,
        t: reduce ? 0 : now / 1000,
        pcy: tg.pcy,
        y: anim.y,
        s: anim.s,
        wgt: anim.w,
        boost: anim.boost.map((v) => Math.max(0, v)),
        rays,
        verts,
        shelves: L.shelves,
        end: world.end,
        x2: world.x2,
        beam,
        fanP,
        pointer,
        lite: m.phone,
        searching: Boolean(L.matches),
        single: L.focus >= 0,
      };
      // Rays on shelves without a match dim while a search is active.
      if (L.matches)
        scene.wgt = anim.w.map((v, i) => v * (1 + Math.min(0, anim.boost[i])));
      draw(scene);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      if (document.hidden) return;
      if (!paused) raf = requestAnimationFrame(frame);
      // Behind the reader the bench holds still, but it is still drawn once.
      else
        raf = requestAnimationFrame((t) => {
          frame(t);
          cancelAnimationFrame(raf);
        });
    };
    start();
    document.addEventListener("visibilitychange", start);

    const view = viewRef.current;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = view ? view.getBoundingClientRect() : { left: 0, top: 0 };
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = true;
      const lens = lensRef.current;
      if (lens) {
        lens.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0)`;
        lens.style.opacity = "1";
      }
    };
    const leave = () => {
      pointer.on = false;
      if (lensRef.current) lensRef.current.style.opacity = "0";
    };
    view?.addEventListener("pointermove", move);
    view?.addEventListener("pointerleave", leave);

    // Sideways wheels and trackpads travel the bench directly.
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        e.preventDefault();
        window.scrollBy(0, e.deltaX);
      }
    };
    view?.addEventListener("wheel", wheel, { passive: false });

    // Drag or swipe sideways to travel; release keeps a little momentum.
    const scroller = scrollerRef.current;
    const drag = { id: -1, x: 0, y: 0, on: false, v: 0, t: 0 };
    const down = (e: PointerEvent) => {
      dragged.current = false;
      if (e.button !== 0) return;
      if ((e.target as Element).closest(".sp-prism, a, .sp-foot button"))
        return;
      drag.id = e.pointerId;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.on = false;
      drag.v = 0;
      cam.fling = 0;
    };
    const dragMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.on) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - drag.y))
          return;
        drag.on = true;
        dragged.current = true;
        drag.x = e.clientX;
        drag.t = performance.now();
        scroller?.setPointerCapture(e.pointerId);
        scroller?.setAttribute("data-dragging", "");
        return;
      }
      const nowT = performance.now();
      const step = e.clientX - drag.x;
      drag.v = (-step / Math.max(1, nowT - drag.t)) * 16;
      drag.x = e.clientX;
      drag.t = nowT;
      window.scrollBy(0, -step);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      drag.id = -1;
      if (drag.on) {
        cam.fling = clamp(drag.v, -70, 70);
        scroller?.removeAttribute("data-dragging");
      }
      drag.on = false;
    };
    scroller?.addEventListener("pointerdown", down);
    scroller?.addEventListener("pointermove", dragMove);
    scroller?.addEventListener("pointerup", up);
    scroller?.addEventListener("pointercancel", up);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", start);
      view?.removeEventListener("pointermove", move);
      view?.removeEventListener("pointerleave", leave);
      view?.removeEventListener("wheel", wheel);
      scroller?.removeEventListener("pointerdown", down);
      scroller?.removeEventListener("pointermove", dragMove);
      scroller?.removeEventListener("pointerup", up);
      scroller?.removeEventListener("pointercancel", up);
    };
  }, [paused, reduce]);

  // Focus moving to a book out of view scrolls the hidden scroller; hand
  // that movement to the page so the camera follows.
  const fold = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollLeft) {
      window.scrollBy(0, el.scrollLeft);
      el.scrollLeft = 0;
    }
    if (el.scrollTop) el.scrollTop = 0;
  }, []);

  // Arrow keys travel the bench, or step between neighbouring books.
  useEffect(() => {
    if (paused) return;
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && t.closest("input, select, textarea, .sp-prism, .sp-hud")) return;
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (t && t.classList.contains("sp-book")) {
        const next = dir > 0 ? t.nextElementSibling : t.previousElementSibling;
        if (next instanceof HTMLElement) {
          e.preventDefault();
          next.focus();
          return;
        }
      }
      e.preventDefault();
      window.scrollBy({
        top: dir * window.innerWidth * 0.55,
        behavior: reduce ? "auto" : "smooth",
      });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [paused, reduce]);

  // Imperative handles for the page.
  useEffect(() => {
    props.api.current = {
      toStart: () => {
        const to = Math.max(0, m.xs - m.vw * (m.phone ? 0.2 : 0.5));
        if (window.scrollY > to)
          window.scrollTo({ top: to, behavior: reduce ? "auto" : "smooth" });
      },
      rectOf: (id) => {
        const el = viewRef.current?.querySelector(
          `.sp-book[data-id="${CSS.escape(id)}"] .sp-box`,
        );
        return el ? el.getBoundingClientRect() : null;
      },
      focusBook: (id) => {
        const el = viewRef.current?.querySelector<HTMLElement>(
          `.sp-book[data-id="${CSS.escape(id)}"]`,
        );
        el?.focus({ preventScroll: true });
      },
    };
    return () => {
      props.api.current = null;
    };
  }, [m, reduce, props.api]);

  const onHot = useCallback((text: string) => {
    if (hotRef.current) hotRef.current.textContent = text;
  }, []);
  const { onOpen } = props;
  const open = useCallback(
    (id: string) => {
      if (!dragged.current) onOpen(id);
    },
    [onOpen],
  );

  // Prism control.
  const [lo, hi] = thetaRange(m);
  const turn = useRef<{ id: number; a0: number; t0: number } | null>(null);
  const prismDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    turn.current = {
      id: e.pointerId,
      a0: Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2),
      ),
      t0: theta,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const prismMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const t = turn.current;
    if (!t || t.id !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect();
    let da =
      Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2),
      ) - t.a0;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    setTheta(clamp(t.t0 + da, lo, hi));
  };
  const prismUp = () => {
    turn.current = null;
  };
  const prismKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = 1.5 * DEG;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown")
      setTheta((t) => clamp(t - step, lo, hi));
    else if (e.key === "ArrowRight" || e.key === "ArrowUp")
      setTheta((t) => clamp(t + step, lo, hi));
    else if (e.key === "Home") setTheta(m.theta0);
    else return;
    e.preventDefault();
  };

  const camX = bucket * BUCKET;
  const searching = Boolean(matches);
  const spaceH = m.vh + Math.max(0, world.width - m.vw);
  const entryX = m.px - m.r * 0.5;
  const turnedDeg = Math.round((theta - m.theta0) / DEG);

  return (
    <div className="sp-space" style={{ height: ready ? spaceH : undefined }}>
      <div
        className="sp-view"
        ref={viewRef}
        data-phone={m.phone || undefined}
        data-nocanvas={noCanvas || undefined}
        data-layout={layout}
        data-searching={searching || undefined}
      >
        <div className="sp-paper" ref={paperRef} aria-hidden="true" />
        <canvas className="sp-canvas" ref={canvasRef} aria-hidden="true" />
        <div className="sp-scroller" ref={scrollerRef} onScroll={fold}>
          <div
            className="sp-track"
            ref={trackRef}
            data-intro={intro ? "" : undefined}
            style={{ width: world.width }}
          >
            <header
              className="sp-title"
              style={{
                top: m.benchTop + (m.phone ? 10 : 18),
              }}
            >
              <h1>
                <span>Yuvraj’s</span>
                <span>Bookshelf</span>
              </h1>
            </header>
            <p
              className="sp-lede"
              style={
                m.phone
                  ? { left: 16, bottom: m.railH + 14, maxWidth: 236 }
                  : {
                      left: Math.round(m.vw * 0.5),
                      top: m.benchTop + 30,
                      maxWidth: Math.max(
                        180,
                        Math.min(290, m.xs - m.vw * 0.5 - 36),
                      ),
                    }
              }
            >
              A personal library. {props.total > 0 ? props.total : "Some"}{" "}
              books, split into four categories the way a prism splits white
              light.
            </p>
            {!m.phone && (
              <span
                className="sp-mono sp-note sp-note-beam"
                aria-hidden="true"
                style={{
                  left: Math.max(8, entryX - (m.phone ? 96 : 190)),
                  top: tg.pcy + (m.phone ? 96 : 190) * Math.tan(m.beta) - 26,
                  transform: `rotate(${-m.beta / DEG}deg)`,
                }}
              >
                white light
              </span>
            )}

            <button
              type="button"
              className="sp-prism"
              role="slider"
              aria-label="Prism rotation. Turning it changes how far the shelves fan apart."
              aria-valuemin={Math.round((lo - m.theta0) / DEG)}
              aria-valuemax={Math.round((hi - m.theta0) / DEG)}
              aria-valuenow={turnedDeg}
              aria-valuetext={turnedDeg + " degrees from rest"}
              style={{
                left: m.px - m.r,
                top: tg.pcy - m.r,
                width: m.r * 2,
                height: m.r * 2,
              }}
              onPointerDown={prismDown}
              onPointerMove={prismMove}
              onPointerUp={prismUp}
              onPointerCancel={prismUp}
              onKeyDown={prismKey}
              onDoubleClick={() => setTheta(m.theta0)}
            >
              <svg viewBox="-50 -50 100 100" aria-hidden="true">
                <g style={{ transform: `rotate(${theta / DEG}deg)` }}>
                  <polygon
                    className="sp-prism-fallback"
                    points="0,-50 43.3,25 -43.3,25"
                  />
                  <path
                    className="sp-prism-arc"
                    d="M -34 -42 A 54 54 0 0 1 34 -42"
                  />
                  <path
                    className="sp-prism-arc"
                    d="M 34 -42 l -7 -3 M 34 -42 l -2 7"
                  />
                </g>
              </svg>
            </button>
            <div
              className="sp-mono sp-note sp-note-prism"
              aria-hidden="true"
              style={
                m.phone
                  ? { left: 16, top: m.slot0 - m.h0 * 1.1 + 10 }
                  : { left: m.px - m.r * 0.9, top: tg.pcy + m.r * 1.16 + 28 }
              }
            >
              <span>
                prism 60°, turned {turnedDeg >= 0 ? "+" : "−"}
                {Math.abs(turnedDeg)}°
              </span>
              <span>
                n <b ref={indexRef} />
              </span>
              <span>dispersion exaggerated</span>
              <span className="sp-note-how">
                {m.phone
                  ? "swipe to travel · turn the prism"
                  : "scroll, drag or arrow keys to travel · turn the prism"}
              </span>
            </div>

            {state !== "ok" && (
              <div
                className="sp-wait"
                role={state === "error" ? "alert" : "status"}
                style={{
                  left: m.px + m.r * 1.16 + (m.phone ? 26 : 46),
                  top: tg.pcy - 34,
                }}
              >
                {state === "loading" ? (
                  <>
                    <strong>Splitting the light</strong>
                    <span className="sp-mono">collecting the shelf</span>
                  </>
                ) : (
                  <>
                    <strong>The light did not get through</strong>
                    <span className="sp-mono">
                      the shelf could not be loaded
                    </span>
                    <button
                      type="button"
                      className="sp-btn"
                      onClick={props.reload}
                    >
                      Try again
                    </button>
                  </>
                )}
              </div>
            )}

            {noCanvas && ready && (
              <div
                className="sp-fallback-fan"
                aria-hidden="true"
                style={{
                  left: m.px,
                  top: tg.y[0],
                  width: m.fan,
                  height: tg.y[3] - tg.y[0],
                }}
              />
            )}

            {ready &&
              shelves.map((sh) => {
                const i = sh.index;
                const s = tg.s[i];
                const shown = tg.shown[i];
                const big = m.h0 * s * 0.66 >= 130;
                const period = m.vw * 1.15;
                const over = Math.max(560, m.vw * 0.8);
                const visible = shown
                  ? sh.books.filter((b) => {
                      const wx = m.xs + b.x * s;
                      return (
                        wx + b.pw * s > camX - over && wx < camX + m.vw + over
                      );
                    })
                  : [];
                const shelfStyle = {
                  left: m.xs,
                  "--ray": RAYS[i],
                  "--inv": 1 / s,
                } as CSSProperties;
                return (
                  <div
                    key={i}
                    className="sp-shelf"
                    ref={(el) => {
                      shelfEls.current[i] = el;
                    }}
                    data-hidden={!shown || undefined}
                    aria-hidden={!shown || undefined}
                    style={shelfStyle}
                  >
                    <div
                      className="sp-shelf-glass"
                      style={{ width: (world.end - m.xs) / s }}
                      aria-hidden="true"
                    />
                    <div
                      className="sp-shelf-label"
                      ref={(el) => {
                        labelEls.current[i] = el;
                      }}
                    >
                      <span className="sp-mono">
                        0{i + 1} · λ {WAVELENGTHS[i]}
                      </span>
                      <h2>{focuses[i]}</h2>
                      <span className="sp-mono">
                        {searching
                          ? sh.hits + " of " + sh.books.length + " match"
                          : sh.books.length +
                            (sh.books.length === 1 ? " book" : " books")}
                      </span>
                    </div>
                    <div
                      className="sp-shelf-books"
                      ref={(el) => {
                        leanEls.current[i] = el;
                      }}
                      role="group"
                      aria-label={focuses[i]}
                    >
                      {visible.map((b) => (
                        <ShelfBook
                          key={b.item.book.id}
                          p={b}
                          layout={layout}
                          big={big}
                          ghost={searching && !b.match}
                          away={props.awayId === b.item.book.id}
                          wave={(((b.x * s) % period) / period) * 0.55}
                          enter={
                            intro
                              ? intro.base +
                                clamp(
                                  (m.xs + b.x * s - entryX) /
                                    (m.vw - entryX + 240),
                                  0,
                                  1.4,
                                ) *
                                  1.5
                              : -1
                          }
                          onOpen={open}
                          onHot={onHot}
                        />
                      ))}
                    </div>
                    {shown && sh.books.length > 0 && (
                      <span
                        className="sp-mono sp-shelf-end"
                        aria-hidden="true"
                        style={{ left: sh.len + 18 }}
                      >
                        end of {String(focuses[i]).toLowerCase()}
                      </span>
                    )}
                  </div>
                );
              })}

            {ready && (
              <>
                <section
                  className="sp-colophon"
                  aria-label="Colophon"
                  style={{
                    left: m.phone
                      ? world.width - m.vw + 16
                      : world.width - Math.min(470, m.vw * 0.36) - m.vw * 0.05,
                    top:
                      m.benchTop +
                      (m.phone ? 62 : Math.min(60, m.benchH * 0.08)),
                    width: m.phone ? m.vw - 32 : Math.min(470, m.vw * 0.36),
                  }}
                >
                  <span className="sp-mono">Colophon · the rays recombine</span>
                  <p className="sp-colophon-big">
                    You passed <b>{props.pages.sum.toLocaleString("en")}</b>{" "}
                    pages of light.
                  </p>
                  <p>
                    That is the sum of the page counts known for{" "}
                    {props.pages.known} of {props.total} books. The rest are on
                    the shelf but not in the sum.
                  </p>
                  <p className="sp-mono">
                    Every ray on this bench obeys Snell’s law for the index
                    shown at the prism. Set in Fraunces and IBM Plex Mono.
                  </p>
                </section>
                <footer
                  className="sp-foot"
                  style={{
                    left: m.phone ? world.width - m.vw + 16 : world.land.x + 22,
                    top: world.land.y,
                    width: m.phone ? m.vw - 32 : undefined,
                  }}
                >
                  <strong>{site.name}</strong>
                  <span className="sp-mono">
                    {props.total} books · four categories
                  </span>
                  <button
                    type="button"
                    className="sp-link"
                    onClick={() =>
                      window.scrollTo({
                        top: 0,
                        behavior: reduce ? "auto" : "smooth",
                      })
                    }
                  >
                    Back to the first prism
                  </button>
                  <Link className="sp-link" to="/admin">
                    Owner sign in
                  </Link>
                </footer>
              </>
            )}
          </div>
        </div>

        <div className="sp-lens" ref={lensRef} aria-hidden="true" />

        <div className="sp-rail">
          <span className="sp-rail-carriage" aria-hidden="true" />
          <span className="sp-mono sp-rail-pos" aria-hidden="true">
            x <span ref={posRef}>0000</span>
          </span>
          <span
            className="sp-mono sp-rail-hot"
            ref={hotRef}
            aria-hidden="true"
          />
          <span className="sp-mono sp-rail-count">
            {!ready
              ? state === "loading"
                ? "warming up"
                : "no signal"
              : (searching
                  ? shelves.reduce((n, sh) => n + sh.hits, 0) +
                    " of " +
                    props.total +
                    " lit"
                  : m.phone && focus < 0
                    ? "shelves " +
                      (pair * 2 + 1) +
                      "–" +
                      (pair * 2 + 2) +
                      " of 4"
                    : props.total + " volumes") +
                (props.byColour ? " · by binding colour" : "")}
          </span>
        </div>
      </div>
    </div>
  );
}
