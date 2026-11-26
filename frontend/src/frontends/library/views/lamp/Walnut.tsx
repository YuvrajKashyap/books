// Walnut, drawn rather than tiled. Each surface gets its own boards: planks
// of different lengths and widths, each with its own figure (nested
// cathedral arches or straight rift grain), open pores and the odd knot.
// The strict CSP allows no data: or blob: images, so the wood is a canvas
// that lives in the surface itself instead of a CSS background.
import { useLayoutEffect, useRef } from "react";

export type WoodKind = "panel" | "wall" | "rail";

type Spec = {
  plank: [number, number]; // board width across the grain, px
  run: [number, number]; // board length along the grain, px
  dpr: number; // the most device pixels per css pixel worth drawing
};
const specs: Record<WoodKind, Spec> = {
  // The pediment, cornice and plinth: broad boards, seen up close.
  panel: { plank: [74, 168], run: [520, 1500], dpr: 1.5 },
  // The back of each shelf, mostly in shadow behind the books.
  wall: { plank: [58, 132], run: [420, 1250], dpr: 1 },
  // A shelf board edge: one long board, seen as a thin slice.
  rail: { plank: [44, 70], run: [900, 2200], dpr: 1.5 },
};

function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function drawWalnut(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seed: number,
  kind: WoodKind,
) {
  const spec = specs[kind];
  const r = random(seed * 2654435761);
  const span = (lo: number, hi: number) => lo + (hi - lo) * r();
  ctx.fillStyle = "#3a2213";
  ctx.fillRect(0, 0, w, h);
  // Start part-way into a board so no two surfaces line their joints up.
  let y = -span(0, spec.plank[1] * 0.7);
  while (y < h) {
    const ph = span(spec.plank[0], spec.plank[1]);
    let x = -span(0, spec.run[1] * 0.8);
    while (x < w) {
      const pw = span(spec.run[0], spec.run[1]);
      board(ctx, r, x, y, pw, ph);
      x += pw;
    }
    y += ph;
  }
}

function board(
  ctx: CanvasRenderingContext2D,
  r: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const span = (lo: number, hi: number) => lo + (hi - lo) * r();
  const hue = span(17, 29);
  const sat = span(30, 46);
  const lig = span(21, 31);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // The board's own colour, a little lighter through its middle.
  const base = ctx.createLinearGradient(0, y, 0, y + h);
  base.addColorStop(0, `hsl(${hue} ${sat}% ${lig * 0.82}%)`);
  base.addColorStop(span(0.3, 0.7), `hsl(${hue + 2} ${sat + 5}% ${lig}%)`);
  base.addColorStop(1, `hsl(${hue - 1} ${sat}% ${lig * 0.78}%)`);
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);

  // Long drifts of heartwood colour along the grain.
  const drifts = 3 + Math.floor(r() * 4);
  for (let i = 0; i < drifts; i++) {
    const dx = x + span(-0.2, 0.9) * w;
    const dw = span(0.25, 0.9) * w;
    const g = ctx.createLinearGradient(dx, 0, dx + dw, 0);
    const dark = r() < 0.6;
    const c = dark
      ? `hsl(${hue - 6} ${sat}% ${lig * 0.45}% / `
      : `hsl(${hue + 8} ${sat + 12}% ${lig + 16}% / `;
    const a = dark ? span(0.14, 0.3) : span(0.06, 0.14);
    g.addColorStop(0, c + "0)");
    g.addColorStop(0.5, c + a + ")");
    g.addColorStop(1, c + "0)");
    ctx.fillStyle = g;
    const by = y + span(-0.2, 0.9) * h;
    ctx.fillRect(dx, by, dw, span(0.15, 0.6) * h);
  }

  // Growth rings: contours of a long cone cut by the board. A centre inside
  // the board gives cathedral arches; one far outside gives straight grain.
  const cathedral = r() < 0.58;
  const cy = cathedral
    ? y + span(0.2, 0.8) * h
    : y + h / 2 + (r() < 0.5 ? -1 : 1) * span(2.5, 7) * h;
  const cx = x + span(-0.15, 1.15) * w;
  const E = cathedral ? span(9, 26) : span(26, 60);
  const near = Math.min(Math.abs(cy - y), Math.abs(cy - y - h));
  const far = Math.max(Math.abs(cy - y), Math.abs(cy - y - h));
  const inside = cy > y && cy < y + h;
  const k1 = (Math.PI * 2) / span(260, 900);
  const k2 = (Math.PI * 2) / span(90, 240);
  const a1 = span(1, 5);
  const a2 = span(0.3, 1.4);
  const p1 = r() * 6.28;
  const p2 = r() * 6.28;
  // Strokes are gathered by weight and drawn once per weight.
  const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const soft = new Path2D();
  const x0 = x - 4;
  const x1 = x + w + 4;
  let rad = inside ? span(0.8, 2.4) : Math.max(1, near - 3);
  let i = 0;
  while (rad < far + 4 && i < 260) {
    const jitter = span(0.2, 0.9);
    const ph = i * 0.23;
    const wob = (px: number) =>
      a1 * Math.sin(px * k1 + p1) +
      a2 * Math.sin(px * k2 + p2 + ph) +
      jitter * Math.sin(px * 0.05 + i);
    const target = r() < 0.07 ? soft : paths[Math.floor(r() * 4)];
    ring(target, cx, cy, rad, E, x0, x1, wob);
    rad += span(2.1, 5.4) * (rad < 14 ? 1.3 : 1);
    i++;
  }
  const dark = `hsl(${hue - 4} ${sat + 10}% ${lig * 0.28}% / `;
  const widths = [0.6, 0.9, 1.3, 1.9];
  const alphas = [0.3, 0.23, 0.18, 0.13];
  paths.forEach((p, n) => {
    ctx.lineWidth = widths[n];
    ctx.strokeStyle = dark + alphas[n] + ")";
    ctx.stroke(p);
  });
  ctx.lineWidth = span(3, 7);
  ctx.strokeStyle = `hsl(${hue + 6} ${sat + 14}% ${lig + 20}% / 0.07)`;
  ctx.stroke(soft);

  // A knot now and then, with the grain swirling round it.
  if (r() < 0.2) {
    const kx = x + span(0.12, 0.88) * w;
    const ky = y + span(0.25, 0.75) * h;
    const kr = span(3.5, 9);
    for (let n = 6; n >= 1; n--) {
      ctx.beginPath();
      ctx.ellipse(
        kx,
        ky,
        kr * (1 + n * 0.9),
        kr * 0.55 * (1 + n * 0.55),
        0,
        0,
        6.2832,
      );
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = dark + (0.05 + 0.05 * (6 - n)) + ")";
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr * 1.4);
    g.addColorStop(0, `hsl(${hue - 6} ${sat}% ${lig * 0.18}% / 0.95)`);
    g.addColorStop(0.6, `hsl(${hue - 4} ${sat}% ${lig * 0.35}% / 0.7)`);
    g.addColorStop(1, `hsl(${hue - 4} ${sat}% ${lig * 0.5}% / 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(kx, ky, kr * 1.5, kr * 0.95, 0, 0, 6.2832);
    ctx.fill();
  }

  // Open pores: short dark flecks running with the grain.
  const pores = new Path2D();
  const count = Math.round((w * h) / 520);
  for (let n = 0; n < count; n++) {
    const px = x + r() * w;
    const py = y + r() * h;
    pores.moveTo(px, py);
    pores.lineTo(px + span(1.5, 6), py + span(-0.3, 0.3));
  }
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = dark + "0.28)";
  ctx.stroke(pores);

  // Joints: a dark seam and the faint catch of light on the next edge.
  ctx.fillStyle = "rgba(6, 2, 0, 0.7)";
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = "rgba(255, 214, 160, 0.06)";
  ctx.fillRect(x, y + 1, w, 1);
  ctx.fillRect(x + 1, y, 1, h);
  ctx.restore();
}

// One growth ring: both long sides of an ellipse stretched E times along x,
// clipped to the board, with the grain's wander added as it goes.
function ring(
  p: Path2D,
  cx: number,
  cy: number,
  rad: number,
  E: number,
  x0: number,
  x1: number,
  wob: (x: number) => number,
) {
  const a = clamp((x0 - cx) / (E * rad), -1, 1);
  const b = clamp((x1 - cx) / (E * rad), -1, 1);
  if (b - a < 1e-4) return;
  const t0 = Math.asin(a);
  const t1 = Math.asin(b);
  const n = Math.min(
    220,
    Math.max(8, Math.ceil(((b - a) * E * rad + (t1 - t0) * rad) / 9)),
  );
  for (let side = -1; side <= 1; side += 2) {
    for (let j = 0; j <= n; j++) {
      const t = t0 + ((t1 - t0) * j) / n;
      const px = cx + E * rad * Math.sin(t);
      const py = cy + side * rad * Math.cos(t) + wob(px);
      if (j) p.lineTo(px, py);
      else p.moveTo(px, py);
    }
  }
}

// A canvas that fills its positioned parent with walnut and redraws when
// the parent changes size. Same seed, same boards.
export function Walnut({
  seed,
  kind = "panel",
}: {
  seed: number;
  kind?: WoodKind;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const draw = () => {
      raf = 0;
      const cw = c.clientWidth;
      const ch = c.clientHeight;
      if (!cw || !ch || (cw === w && ch === h)) return;
      w = cw;
      h = ch;
      const dpr = Math.min(window.devicePixelRatio || 1, specs[kind].dpr);
      c.width = Math.round(cw * dpr);
      c.height = Math.round(ch * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWalnut(ctx, cw, ch, seed, kind);
    };
    const ask = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    // Drawn straight away, so the first paint already has its wood.
    draw();
    const ro = new ResizeObserver(ask);
    ro.observe(c);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [seed, kind]);
  return <canvas className="walnut" ref={ref} aria-hidden="true" />;
}
