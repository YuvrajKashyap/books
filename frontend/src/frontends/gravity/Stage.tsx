// The fixed stage: the WebGL fabric behind, the CSS 3D shelves in front, and
// the one loop that moves the camera, weighs the books and fills the readouts.
import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { ShelfBook } from "./Book";
import type { BookHandlers } from "./Book";
import { Fabric } from "./scene";
import {
  BOOK_H,
  EYE_H,
  NEAR,
  OVERRUN,
  ROW_GAP,
  STEP,
  TILT,
  aspectOf,
  clamp,
  pad,
  project,
  signed,
  smooth,
  toFabric,
} from "./layout";
import type { Camera, Layout, Plan } from "./layout";

export type Probe = { x: number; y: number; r: number };
export type View = { w: number; h: number; P: number; originY: number };
export type StageApi = {
  restRect: (id: string) => DOMRect | null;
  focusBook: (id: string) => void;
  toRow: (row: number, smoothly: boolean) => void;
};

type Props = {
  plan: Plan;
  layout: Layout;
  lite: boolean;
  view: View;
  phase: "loading" | "ok" | "error";
  searching: boolean;
  pulse: string; // changes whenever the shelf is re-formed
  reading: boolean;
  awayId: string | null;
  probe: RefObject<Probe | null>;
  api: RefObject<StageApi | null>;
  nameRef: RefObject<HTMLElement | null>;
  onOpen: (id: string, from: DOMRect) => void;
  onFail: () => void;
  onSkyName: (on: boolean) => void;
};

// Draw the name exactly where the page sets it, so the sky can take it over.
function drawName(h1: HTMLElement, dpr: number) {
  const box = h1.getBoundingClientRect();
  if (box.width < 10 || box.height < 10) return null;
  const pad = Math.ceil(box.height * 0.3);
  const scale = Math.min(dpr, 4096 / (box.width + pad * 2));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((box.width + pad * 2) * scale);
  canvas.height = Math.ceil((box.height + pad * 2) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  for (const part of Array.from(h1.children)) {
    const text = part.textContent ?? "";
    if (!text) continue;
    const cs = getComputedStyle(part);
    const r = part.getBoundingClientRect();
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    if ("letterSpacing" in spaced && cs.letterSpacing !== "normal")
      spaced.letterSpacing = cs.letterSpacing;
    const mt = ctx.measureText(text);
    const up = mt.fontBoundingBoxAscent ?? mt.actualBoundingBoxAscent;
    const down = mt.fontBoundingBoxDescent ?? mt.actualBoundingBoxDescent;
    ctx.fillText(
      text,
      r.left - box.left + pad,
      r.top - box.top + pad + (r.height - (up + down)) / 2 + up,
    );
  }
  return { canvas, pad };
}

type Reg = {
  el: HTMLElement;
  landAt: number;
  landed: boolean;
  m: number;
  v: number;
  veil: number;
};

export function Stage(props: Props) {
  const { plan, layout, lite, view, phase, searching, reading, awayId } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<HTMLSpanElement>(null);
  const markRef = useRef<HTMLElement>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const speedRef = useRef<HTMLSpanElement>(null);
  const bodiesRef = useRef<HTMLSpanElement>(null);
  const fabricRef = useRef<Fabric | null>(null);
  const regs = useRef(new Map<string, Reg>());
  const delays = useRef(new Map<string, number>());
  const entranceUntil = useRef(0);
  const okAt = useRef(0);
  const resized = useRef(0);
  const namePad = useRef(0);

  const [base, setBase] = useState(0);
  const [armed, setArmed] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  // Everything the loop reads, refreshed on every render.
  const live = useRef({ ...props, target });
  live.current = { ...props, target };

  const motion = useRef({
    s: 0,
    v: 0,
    rb: 0,
    px: view.w / 2,
    py: view.h * 0.7,
    tx: view.w / 2,
    ty: view.h * 0.7,
    strength: 0,
    wanted: 0,
    moved: false,
    lx: view.w / 2,
    ly: view.h / 2,
    theta: 0,
    ring: 0,
    stretch: 0,
    rx: 0,
    rz: 0,
  });

  const rows = plan.rows;
  const maxS = Math.max(0, rows - 1 + OVERRUN);
  const ahead = layout === "spines" ? 4 : lite ? 5 : 6;

  // At the top of the page the whole scene sits lower, under the name.
  const liftAt = (scrollY: number, h: number) =>
    (1 - smooth(0, 1.1, scrollY / STEP)) * h * 0.13;

  const restCamera = (): Camera => ({
    P: live.current.view.P,
    pitch: TILT,
    eyeH: EYE_H,
    ez: NEAR - clamp(window.scrollY / STEP, 0, maxS) * ROW_GAP,
  });

  const handlers = useMemo<BookHandlers>(
    () => ({
      register(id, el, delay) {
        if (!el) {
          regs.current.delete(id);
          delays.current.delete(id);
          return;
        }
        regs.current.set(id, {
          el,
          landAt: performance.now() + delay + 480,
          landed: false,
          m: 0,
          v: 0,
          veil: -1,
        });
      },
      open(id, from) {
        const slot = live.current.plan.byId.get(id);
        if (slot) fabricRef.current?.ripple(slot.x, slot.z, 24);
        live.current.onOpen(id, from);
      },
      target(id, viaFocus) {
        setTarget(id);
        if (!id) return;
        const slot = live.current.plan.byId.get(id);
        if (!slot) return;
        fabricRef.current?.ripple(slot.x, slot.z, 8);
        if (viaFocus && Math.abs(slot.row - motion.current.s) > 0.55)
          window.scrollTo({ top: slot.row * STEP, behavior: "smooth" });
      },
    }),
    [],
  );

  useEffect(() => {
    props.api.current = {
      restRect(id) {
        const slot = live.current.plan.byId.get(id);
        if (!slot) return null;
        const v = live.current.view;
        const h = BOOK_H * slot.art.heightScale * slot.scale;
        const w = h * aspectOf(id);
        const spine = live.current.layout === "spines";
        const depth = slot.art.depth * slot.scale;
        const p = project(
          restCamera(),
          slot.x,
          -h / 2,
          slot.z + (spine ? w : depth) / 2,
        );
        if (!p) return null;
        const pw = (spine ? depth : w) * p.scale;
        const ph = h * p.scale;
        return new DOMRect(
          v.w / 2 + p.x - pw / 2,
          v.originY + liftAt(window.scrollY, v.h) + p.y - ph / 2,
          pw,
          ph,
        );
      },
      focusBook(id) {
        const el = regs.current
          .get(id)
          ?.el.querySelector<HTMLElement>(".gw-hit");
        el?.focus({ preventScroll: true });
      },
      toRow(row, smoothly) {
        window.scrollTo({
          top: row * STEP,
          behavior: smoothly ? "smooth" : "instant",
        });
      },
    };
    return () => {
      props.api.current = null;
    };
  });

  // Entrance: the grid draws first, then the books are allowed to arrive.
  useEffect(() => {
    if (phase !== "ok") {
      setArmed(false);
      return;
    }
    okAt.current = performance.now();
    const t = window.setTimeout(() => {
      entranceUntil.current = performance.now() + 400;
      setArmed(true);
    }, 420);
    return () => window.clearTimeout(t);
  }, [phase]);

  // Once the fonts are in and the name has settled, hand it to the sky.
  useEffect(() => {
    if (lite) return;
    let active = true;
    const t = window.setTimeout(() => {
      const draw = () => {
        const h1 = props.nameRef.current;
        const fabric = fabricRef.current;
        if (!active || !h1 || !fabric) return;
        const made = drawName(h1, Math.min(window.devicePixelRatio || 1, 2));
        if (!made) return;
        namePad.current = made.pad;
        fabric.setName(made.canvas);
      };
      if (document.fonts?.ready) document.fonts.ready.then(draw, draw);
      else draw();
    }, 1000);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lite, view.w, view.h]);

  // A wave whenever the shelf is re-formed by search, category, sort or layout.
  const firstPulse = useRef(true);
  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false;
      return;
    }
    const z = -motion.current.s * ROW_GAP;
    fabricRef.current?.ripple(0, z, 11);
  }, [props.pulse]);

  // The book that was being read lands back on its shelf.
  const wasAway = useRef<string | null>(null);
  useEffect(() => {
    const before = wasAway.current;
    wasAway.current = awayId;
    if (before && !awayId) {
      const slot = live.current.plan.byId.get(before);
      if (slot) fabricRef.current?.ripple(slot.x, slot.z, 20);
    }
  }, [awayId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    const stage = stageRef.current;
    if (!canvas || !world || !stage) return;
    let fabric: Fabric;
    try {
      fabric = new Fabric(canvas, lite);
    } catch {
      live.current.onFail();
      return;
    }
    fabricRef.current = fabric;
    {
      const v = live.current.view;
      fabric.resize(v.w, v.h, v.P, v.originY);
    }

    const m = motion.current;
    const lost = (e: Event) => {
      e.preventDefault();
      live.current.onFail();
    };
    canvas.addEventListener("webglcontextlost", lost);

    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      m.tx = e.clientX;
      m.ty = e.clientY;
      m.wanted = 1;
      m.moved = true;
    };
    const touch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      m.tx = t.clientX;
      m.ty = t.clientY;
      m.wanted = 1;
    };
    const release = () => {
      m.wanted = 0;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("touchstart", touch, { passive: true });
    window.addEventListener("touchmove", touch, { passive: true });
    window.addEventListener("touchend", release, { passive: true });
    window.addEventListener("touchcancel", release, { passive: true });
    document.documentElement.addEventListener("mouseleave", release);

    let raf = 0;
    let last = performance.now();
    let lastBase = -1;
    let lastOy = -1;
    let seenResize = resized.current;
    let frames = 0;
    let skyName = false;
    const written = { gauge: "", coord: "", speed: "", bodies: "" };
    const order: { d: number; i: number }[] = [];
    const staged = new Float32Array(400 * 4);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
      last = now;
      const L = live.current;
      const v = L.view;
      const time = now / 1000;
      frames++;
      const top = Math.max(0, L.plan.rows - 1 + OVERRUN);

      // Camera: scroll carries it through depth, with a little weight.
      const want = clamp(window.scrollY / STEP, 0, top);
      const before = m.s;
      m.s += (want - m.s) * (1 - Math.exp(-dt * 7));
      if (Math.abs(want - m.s) < 0.0004) m.s = want;
      m.v += ((m.s - before) / dt - m.v) * (1 - Math.exp(-dt * 10));
      m.rb += ((L.reading ? 1 : 0) - m.rb) * (1 - Math.exp(-dt * 3.4));
      const rb = m.rb < 0.001 ? 0 : m.rb;
      const cam: Camera = {
        P: v.P,
        pitch: TILT + rb * 0.2,
        eyeH: EYE_H + rb * 230,
        ez: NEAR - m.s * ROW_GAP + rb * 160,
      };
      const oy = Math.round(v.originY + liftAt(window.scrollY, v.h) * (1 - rb));
      if (seenResize !== resized.current) {
        seenResize = resized.current;
        lastOy = -1;
      }
      if (oy !== lastOy) {
        lastOy = oy;
        stage.style.perspectiveOrigin = `50% ${oy}px`;
        fabric.setOrigin(oy);
      }
      world.style.transform = `translate3d(0,${oy}px,0) translateZ(${v.P}px) rotateX(${(-cam.pitch).toFixed(5)}rad) translate3d(0,${cam.eyeH.toFixed(2)}px,${(-cam.ez).toFixed(2)}px)`;

      const b = Math.floor(m.s);
      if (b !== lastBase) {
        lastBase = b;
        setBase(b);
      }

      // Pointer mass.
      m.px += (m.tx - m.px) * (1 - Math.exp(-dt * 11));
      m.py += (m.ty - m.py) * (1 - Math.exp(-dt * 11));
      m.strength += (m.wanted - m.strength) * (1 - Math.exp(-dt * 4));
      const hit = toFabric(cam, m.px - v.w / 2, m.py - oy);
      const pointerDepth = hit ? m.strength * (lite ? 52 : 68) * (1 - rb) : 0;

      // Books: weigh each one, fog it by distance, hand the wells to the shader.
      let n = 0;
      for (const [id, reg] of regs.current) {
        const slot = L.plan.byId.get(id);
        if (!slot) continue;
        let goal = slot.well;
        if (L.searching) goal *= slot.match ? 1.75 : 0.06;
        if (now < reg.landAt || id === L.target || id === L.awayId || L.reading)
          goal = 0;
        if (!reg.landed && now >= reg.landAt) {
          reg.landed = true;
          if (slot.col === 0 && now < entranceUntil.current + 6000)
            fabric.ripple(slot.x, slot.z, 6);
        }
        reg.v += ((goal - reg.m) * 70 - reg.v * 10) * dt;
        reg.m += reg.v * dt;
        const d = cam.ez - slot.z;
        const veil = Math.round(smooth(1500, 4300, d) * 0.9 * 50) / 50;
        if (veil !== reg.veil) {
          reg.veil = veil;
          reg.el.style.setProperty("--veil", String(veil));
        }
        if (Math.abs(reg.m) > 0.4 && n < 400) {
          staged[n * 4] = slot.x;
          staged[n * 4 + 1] = slot.z;
          staged[n * 4 + 2] = reg.m;
          staged[n * 4 + 3] = slot.sigma;
          n++;
        }
      }
      const max = fabric.maxWells;
      if (n <= max) {
        fabric.wells.set(staged.subarray(0, n * 4));
        fabric.wellCount = n;
      } else {
        order.length = 0;
        for (let i = 0; i < n; i++)
          order.push({
            d:
              Math.abs(cam.ez - staged[i * 4 + 1] - NEAR) -
              staged[i * 4 + 2] * 4,
            i,
          });
        order.sort((a, c) => a.d - c.d);
        for (let k = 0; k < max; k++) {
          const i = order[k].i * 4;
          fabric.wells.set(staged.subarray(i, i + 4), k * 4);
        }
        fabric.wellCount = max;
      }

      // Lens: the pointer, or the book being read.
      const p = L.reading ? L.probe.current : null;
      // The name's place on screen, for the sky copy of it.
      const h1 = fabric.hasName ? L.nameRef.current : null;
      const nb = h1 ? h1.getBoundingClientRect() : null;
      if (nb && !skyName && frames > 24) {
        skyName = true;
        L.onSkyName(true);
      }
      // Until the pointer moves, a mass of its own drifts across the name.
      const idle =
        !m.moved && !lite && !p && nb !== null && window.scrollY < 40;
      const pull = idle ? 0.85 : m.strength;
      const lensX = p
        ? p.x
        : idle && nb
          ? nb.left + nb.width / 2 + Math.cos(time * 0.42) * nb.width * 0.38
          : m.px;
      const lensY = p
        ? p.y
        : idle && nb
          ? nb.top + nb.height / 2 + Math.sin(time * 0.66) * nb.height * 0.2
          : m.py;
      const theta = p ? p.r : lite ? 0 : Math.min(v.w, v.h) * 0.095 * pull;
      const k = 1 - Math.exp(-dt * (p || idle ? 5 : 14));
      m.lx += (lensX - m.lx) * k;
      m.ly += (lensY - m.ly) * k;
      m.theta += (theta - m.theta) * (1 - Math.exp(-dt * 5));
      m.ring += ((p ? 1 : 0.8 * pull) - m.ring) * (1 - Math.exp(-dt * 5));
      m.stretch +=
        (Math.min(15, Math.abs(m.v) * 3.4) - m.stretch) *
        (1 - Math.exp(-dt * 8));

      // The well the open book falls into.
      if (p) {
        const under = toFabric(cam, p.x - v.w / 2, p.y + p.r * 0.95 - oy);
        if (under) {
          m.rx = under.x;
          m.rz = under.z;
        }
      }

      const reveal =
        L.phase === "ok"
          ? 1 - Math.pow(1 - clamp((now - okAt.current) / 1500, 0, 1), 3)
          : 0;
      const spark =
        L.phase === "error"
          ? 0.4
          : (1 - smooth(0.04, 0.45, reveal)) *
            (0.78 + 0.22 * Math.sin(time * 3.2));

      fabric.render({
        time,
        cam,
        pointer: {
          x: hit ? hit.x : 0,
          z: hit ? hit.z : 0,
          depth: pointerDepth,
          sigma: 150,
        },
        reader: { x: m.rx, z: m.rz, depth: 340 * rb, sigma: 470 },
        lens: { x: m.lx, y: m.ly, theta: m.theta, ring: m.ring },
        stretch: m.stretch,
        reveal,
        spark,
        origin: { x: 0, z: 0 },
        name: nb
          ? {
              x: nb.left - namePad.current,
              y: nb.top - namePad.current,
              w: nb.width + namePad.current * 2,
              h: nb.height + namePad.current * 2,
              on: skyName ? 1 - rb : 0,
            }
          : { x: 0, y: 0, w: 1, h: 1, on: 0 },
      });

      // Instrument readouts, all read off the live scene.
      const total = L.plan.rows;
      const shelf = total ? clamp(Math.round(m.s) + 1, 1, total) : 0;
      const gauge = `${pad(shelf)} / ${pad(total)}`;
      if (gauge !== written.gauge && gaugeRef.current) {
        written.gauge = gauge;
        gaugeRef.current.textContent = gauge;
      }
      if (markRef.current)
        markRef.current.style.transform = `translate3d(0,${(clamp(total > 1 ? m.s / (total - 1) : 0, 0, 1) * 100).toFixed(2)}%,0)`;
      const coord =
        hit && m.strength > 0.05
          ? `X ${signed(hit.x)}  Z ${signed(-hit.z, 5)}`
          : "OFF THE SHEET";
      if (coord !== written.coord && coordRef.current) {
        written.coord = coord;
        coordRef.current.textContent = coord;
      }
      const speed =
        Math.abs(m.v) < 0.005
          ? "AT REST"
          : `${Math.abs(m.v).toFixed(2)} SHELVES/S`;
      if (speed !== written.speed && speedRef.current) {
        written.speed = speed;
        speedRef.current.textContent = speed;
      }
      const bodies = pad(regs.current.size, 3);
      if (bodies !== written.bodies && bodiesRef.current) {
        written.bodies = bodies;
        bodiesRef.current.textContent = bodies;
      }

      // The label that follows the book under the pointer.
      const tag = tagRef.current;
      if (tag && L.target) {
        const el = regs.current.get(L.target)?.el.querySelector(".gw-hit");
        if (el) {
          const r = el.getBoundingClientRect();
          const x = clamp(r.left + r.width / 2, 130, v.w - 130);
          tag.style.transform = `translate3d(${x.toFixed(1)}px,${Math.max(96, r.top - 16).toFixed(1)}px,0)`;
        }
      }
    };

    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const visible = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", visible);
    visible();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", visible);
      canvas.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("touchstart", touch);
      window.removeEventListener("touchmove", touch);
      window.removeEventListener("touchend", release);
      window.removeEventListener("touchcancel", release);
      document.documentElement.removeEventListener("mouseleave", release);
      fabric.dispose();
      fabricRef.current = null;
      live.current.onSkyName(false);
    };
  }, [lite]);

  useEffect(() => {
    fabricRef.current?.resize(view.w, view.h, view.P, view.originY);
    resized.current++;
  }, [view.w, view.h, view.P, view.originY, lite]);

  const mounted =
    armed && phase === "ok"
      ? plan.slots.filter((s) => s.row >= base - 1 && s.row <= base + ahead)
      : [];
  const entering = performance.now() < entranceUntil.current;
  const targetSlot = target ? plan.byId.get(target) : undefined;

  return (
    <div
      ref={stageRef}
      className="gw-stage"
      style={{ perspective: view.P + "px", height: view.h + "px" }}
    >
      <canvas ref={canvasRef} className="gw-canvas" aria-hidden="true" />
      <div
        ref={worldRef}
        className="gw-world"
        role="group"
        aria-label="Books on the shelves"
      >
        {mounted.map((slot, k) => {
          let delay = delays.current.get(slot.id);
          if (delay === undefined) {
            delay = entering ? 40 + k * 26 : 30 + slot.col * 22;
            delays.current.set(slot.id, delay);
          }
          return (
            <ShelfBook
              key={slot.id}
              slot={slot}
              layout={layout}
              lite={lite}
              delay={delay}
              away={awayId === slot.id}
              searching={searching}
              handlers={handlers}
            />
          );
        })}
        {armed &&
          phase === "ok" &&
          !lite &&
          plan.marks
            .filter((mk) => mk.row >= base && mk.row <= base + 2)
            .map((mk) => (
              <p
                key={mk.row}
                className={"gw-mark" + (layout === "spines" ? " is-spine" : "")}
                aria-hidden="true"
                style={{
                  transform: `translate3d(${mk.x.toFixed(1)}px,0,${mk.z.toFixed(1)}px) rotateY(${mk.yaw.toFixed(4)}rad) translate3d(0,9px,${layout === "spines" ? 136 : 72}px)`,
                }}
              >
                <span>
                  <b>Shelf {pad(mk.row + 1)}</b>
                  {mk.count} {mk.count === 1 ? "body" : "bodies"} ·{" "}
                  {mk.pages.toLocaleString("en-US")} pp
                  {mk.measured < mk.count
                    ? ` across ${mk.measured} measured`
                    : ""}
                </span>
              </p>
            ))}
      </div>

      <div
        ref={tagRef}
        className={"gw-tag" + (targetSlot && !reading ? " is-on" : "")}
        aria-hidden="true"
      >
        {targetSlot && (
          <div className="gw-tag-card">
            <b>{targetSlot.art.title}</b>
            <span>{targetSlot.book.author}</span>
            <small>
              {targetSlot.art.pages
                ? `Mass ${targetSlot.art.pages} pp`
                : "Mass unmeasured"}
              {" · "}Shelf {pad(targetSlot.row + 1)} · Slot{" "}
              {pad(targetSlot.col + 1)}
            </small>
          </div>
        )}
      </div>

      <aside className="gw-rail gw-rail-right" aria-hidden="true">
        <p className="gw-label">Shelf</p>
        <p className="gw-gauge">
          <span ref={gaugeRef}>00 / 00</span>
        </p>
        <div className="gw-depth">
          {Array.from({ length: Math.min(rows, 48) }, (_, i) => (
            <i key={i} />
          ))}
          <b ref={markRef} />
        </div>
        <p className="gw-label">Pointer mass</p>
        <p className="gw-read">
          <span ref={coordRef}>OFF THE SHEET</span>
        </p>
        <p className="gw-label">Camera</p>
        <p className="gw-read">
          <span ref={speedRef}>AT REST</span>
        </p>
        <p className="gw-label">Bodies in range</p>
        <p className="gw-read">
          <span ref={bodiesRef}>000</span>
        </p>
      </aside>
    </div>
  );
}
