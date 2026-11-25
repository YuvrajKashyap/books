// Everything painted on the bench canvas: the white beam, both prisms, the
// four rays, the glass shelves, the shadows and caustics under the books,
// and the optical rail along the bottom edge.
import { RAY_RGB, type Metrics, type Shelf } from "./layout";
import type { RayPath, Vec } from "./optics";

export type Scene = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  m: Metrics;
  cam: number;
  t: number; // seconds, frozen when motion is reduced
  pcy: number;
  y: number[];
  s: number[];
  wgt: number[]; // 0 hidden to 1 shown, per ray
  boost: number[]; // extra intensity while a search has matches there
  rays: RayPath[];
  verts: Vec[];
  shelves: Shelf[];
  end: number; // world x where the glass ends
  x2: number; // world x of the recombining prism
  beam: number; // 0 to 1, the white beam drawing in
  fanP: number; // 0 to 1, the rays running out along the shelves
  pointer: { x: number; y: number; on: boolean };
  lite: boolean;
  searching: boolean;
  single: boolean;
};

const INK = "34,38,46";
const col = (i: number, a: number) => {
  const c = RAY_RGB[i];
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};

function whiteBeam(
  ctx: CanvasRenderingContext2D,
  a: Vec,
  b: Vec,
  width: number,
  alpha = 1,
) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.5) return;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "butt";
  ctx.shadowColor = "rgba(255,255,255,1)";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(${INK},.34)`;
  ctx.lineWidth = 0.6;
  const o = width / 2 + 0.5;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * o, a.y + ny * o);
  ctx.lineTo(b.x + nx * o, b.y + ny * o);
  ctx.moveTo(a.x - nx * o, a.y - ny * o);
  ctx.lineTo(b.x - nx * o, b.y - ny * o);
  ctx.stroke();
  ctx.restore();
}

function taper(
  ctx: CanvasRenderingContext2D,
  a: Vec,
  b: Vec,
  wa: number,
  wb: number,
) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len;
  const ny = (b.x - a.x) / len;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * wa, a.y + ny * wa);
  ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
  ctx.lineTo(b.x - nx * wb, b.y - ny * wb);
  ctx.lineTo(a.x - nx * wa, a.y - ny * wa);
  ctx.closePath();
}

function glass(
  ctx: CanvasRenderingContext2D,
  v: Vec[],
  glow: number,
  lite: boolean,
) {
  const cx = (v[0].x + v[1].x + v[2].x) / 3;
  const cy = (v[0].y + v[1].y + v[2].y) / 3;
  const path = (k: number) => {
    ctx.beginPath();
    v.forEach((p, i) => {
      const x = cx + (p.x - cx) * k;
      const y = cy + (p.y - cy) * k;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
  };
  ctx.save();
  // Shadow on the paper, thrown down and to the right.
  if (!lite) {
    ctx.shadowColor = "rgba(40,52,78,.2)";
    ctx.shadowBlur = 34;
    ctx.shadowOffsetX = 16;
    ctx.shadowOffsetY = 26;
  }
  const minX = Math.min(v[0].x, v[1].x, v[2].x);
  const maxX = Math.max(v[0].x, v[1].x, v[2].x);
  const minY = Math.min(v[0].y, v[1].y, v[2].y);
  const maxY = Math.max(v[0].y, v[1].y, v[2].y);
  const g = ctx.createLinearGradient(minX, minY, maxX, maxY);
  g.addColorStop(0, "rgba(255,255,255,.92)");
  g.addColorStop(0.45, "rgba(226,236,242,.62)");
  g.addColorStop(1, "rgba(196,212,226,.72)");
  path(1);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = "transparent";
  if (glow > 0.01) {
    const r = (maxX - minX) * 0.6;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, `rgba(255,255,255,${0.95 * glow})`);
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fill();
  }
  ctx.strokeStyle = `rgba(${INK},.78)`;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.stroke();
  // Bevel: a second triangle just inside the first.
  path(0.88);
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = `rgba(${INK},.16)`;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // A single specular stroke along one face.
  ctx.beginPath();
  const a = v[2];
  const b = v[0];
  ctx.moveTo(
    a.x + (b.x - a.x) * 0.2 + (cx - a.x) * 0.1,
    a.y + (b.y - a.y) * 0.2 + (cy - a.y) * 0.1,
  );
  ctx.lineTo(
    a.x + (b.x - a.x) * 0.62 + (cx - a.x) * 0.1,
    a.y + (b.y - a.y) * 0.62 + (cy - a.y) * 0.1,
  );
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

function spark(ctx: CanvasRenderingContext2D, p: Vec, r: number, a: number) {
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.35, `rgba(255,255,255,${a * 0.5})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
}

// Outward unit normal of the prism face nearest to a point on its edge.
function nearestFace(v: Vec[], p: Vec): Vec | null {
  const cx = (v[0].x + v[1].x + v[2].x) / 3;
  const cy = (v[0].y + v[1].y + v[2].y) / 3;
  let best: Vec | null = null;
  let near = Infinity;
  for (let i = 0; i < 3; i++) {
    const a = v[i];
    const b = v[(i + 1) % 3];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.hypot(ex, ey) || 1;
    const dist = Math.abs((p.x - a.x) * ey - (p.y - a.y) * ex) / len;
    if (dist >= near) continue;
    near = dist;
    let nx = ey / len;
    let ny = -ex / len;
    if (nx * (a.x - cx) + ny * (a.y - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    best = { x: nx, y: ny };
  }
  return best;
}

// A divided circle around the prism, with an index that follows its apex.
function dial(ctx: CanvasRenderingContext2D, c: Vec, r: number, apex: Vec) {
  const R = r * 1.16;
  ctx.save();
  ctx.strokeStyle = `rgba(${INK},.3)`;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
  for (let k = 0; k < 72; k++) {
    const a = (k * Math.PI) / 36;
    const len = k % 6 === 0 ? 9 : k % 2 === 0 ? 5 : 3;
    ctx.moveTo(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R);
    ctx.lineTo(c.x + Math.cos(a) * (R + len), c.y + Math.sin(a) * (R + len));
  }
  ctx.stroke();
  const a = Math.atan2(apex.y - c.y, apex.x - c.x);
  ctx.fillStyle = `rgba(${INK},.85)`;
  ctx.beginPath();
  ctx.moveTo(c.x + Math.cos(a) * (R - 2), c.y + Math.sin(a) * (R - 2));
  ctx.lineTo(
    c.x + Math.cos(a - 0.035) * (R + 13),
    c.y + Math.sin(a - 0.035) * (R + 13),
  );
  ctx.lineTo(
    c.x + Math.cos(a + 0.035) * (R + 13),
    c.y + Math.sin(a + 0.035) * (R + 13),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function rail(sc: Scene) {
  const { ctx, w, h, m, cam } = sc;
  const y0 = h - m.railH;
  ctx.fillStyle = "#ebe9e1";
  ctx.fillRect(0, y0, w, m.railH);
  ctx.strokeStyle = `rgba(${INK},.6)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y0 + 0.5);
  ctx.lineTo(w, y0 + 0.5);
  const from = Math.floor((cam - m.xs) / 10) * 10;
  for (let u = from; u < cam - m.xs + w + 10; u += 10) {
    const x = Math.round(u + m.xs - cam) + 0.5;
    const k = ((u % 100) + 100) % 100;
    const len = k === 0 ? 14 : k === 50 ? 9 : 5;
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + len);
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(${INK},.62)`;
  ctx.font = '500 9px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textBaseline = "top";
  const big = Math.floor((cam - m.xs) / 100) * 100;
  for (let u = big; u < cam - m.xs + w + 100; u += 100)
    ctx.fillText(String(u / 10), u + m.xs - cam + 4, y0 + 9);
}

export function draw(sc: Scene) {
  const { ctx, w, h, m, cam, rays, lite } = sc;
  ctx.clearRect(0, 0, w, h);
  const benchBottom = h - m.railH;
  const sx = (p: Vec): Vec => ({ x: p.x - cam, y: p.y });

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, benchBottom);
  ctx.clip();

  const entry = rays[0].entry;
  const dir = { x: Math.cos(m.beta), y: -Math.sin(m.beta) };
  const nearFirst = cam < m.xs + 80;

  // The incoming white beam.
  if (nearFirst && sc.beam > 0) {
    const run = (entry.x + 60) / dir.x;
    const from = { x: entry.x - dir.x * run, y: entry.y - dir.y * run };
    const to = {
      x: from.x + (entry.x - from.x) * sc.beam,
      y: from.y + (entry.y - from.y) * sc.beam,
    };
    whiteBeam(ctx, sx(from), sx(to), m.phone ? 3 : 4);
    if (sc.beam < 1) spark(ctx, sx(to), 26, 0.95);
  }

  // Light past the prism is revealed left to right while the fan opens.
  ctx.save();
  if (sc.fanP < 1) {
    const head = entry.x - cam + sc.fanP * (w - (entry.x - cam) + 240);
    ctx.beginPath();
    ctx.rect(0, 0, head, benchBottom);
    ctx.clip();
  }

  const gt = (i: number) => Math.max(4, 7 * sc.s[i]);

  // Tinted light: a wedge from each exit point that opens into a band
  // standing on its shelf.
  for (let i = 0; i < 4; i++) {
    const a = sc.wgt[i];
    if (a < 0.02) continue;
    const bandH = m.h0 * sc.s[i] * 1.12;
    const alpha = (sc.single ? 0.085 : 0.05) * a * (1 + sc.boost[i] * 0.9);
    const x0 = m.xs - cam;
    const x1 = sc.end - cam;
    ctx.fillStyle = col(i, alpha);
    if (nearFirst) {
      const e = sx(rays[i].exit);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(x0 + 1, sc.y[i] - bandH);
      ctx.lineTo(x0 + 1, sc.y[i]);
      ctx.closePath();
      ctx.fill();
    }
    const l = Math.max(x0, -10);
    const r = Math.min(x1, w + 10);
    if (r > l) ctx.fillRect(l, sc.y[i] - bandH, r - l, bandH);
    // The band narrows again toward the second prism.
    if (x1 < w + 10) {
      const p = { x: sc.x2 - (rays[i].exit.x - m.px) - cam, y: rays[i].exit.y };
      ctx.beginPath();
      ctx.moveTo(x1 - 1, sc.y[i] - bandH);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(x1 - 1, sc.y[i]);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Shadows and caustics under the glass.
  for (const shelf of sc.shelves) {
    const i = shelf.index;
    const a = sc.wgt[i];
    if (a < 0.05) continue;
    const s = sc.s[i];
    const y = sc.y[i] + gt(i);
    const drop = Math.min(m.gap * 0.27, 58) * Math.min(s, 1.6);
    const lean = drop * 0.5;
    // Light that has come through the glass pools on the paper below it.
    {
      const l = Math.max(m.xs - cam, -20);
      const r = Math.min(sc.end - cam, w + 20);
      if (r > l) {
        const pool = ctx.createLinearGradient(0, y, 0, y + drop * 1.35);
        pool.addColorStop(0, col(i, 0.24 * a));
        pool.addColorStop(0.5, col(i, 0.09 * a));
        pool.addColorStop(1, col(i, 0));
        ctx.fillStyle = pool;
        ctx.fillRect(l, y, r - l, drop * 1.35);
      }
    }
    const g = ctx.createLinearGradient(0, y, 0, y + drop);
    g.addColorStop(0, col(i, 0.55 * a));
    g.addColorStop(0.6, col(i, 0.16 * a));
    g.addColorStop(1, col(i, 0));
    const grey = ctx.createLinearGradient(0, y, 0, y + drop);
    grey.addColorStop(0, `rgba(${INK},${0.1 * a})`);
    grey.addColorStop(1, `rgba(${INK},0)`);
    const lit = new Path2D();
    const dim = new Path2D();
    const slivers = new Path2D();
    let last = -1e9;
    for (const b of shelf.books) {
      const bx = m.xs + b.x * s - cam;
      const bw = b.pw * s;
      if (bx > w + 80) break;
      if (bx + bw < -80) {
        last = bx + bw;
        continue;
      }
      const p = sc.searching && !b.match ? dim : lit;
      p.moveTo(bx, y);
      p.lineTo(bx + bw, y);
      p.lineTo(bx + bw + lean, y + drop);
      p.lineTo(bx + lean, y + drop);
      p.closePath();
      if (last > -1e8 && bx - last > 1.5) {
        const gx = (last + bx) / 2;
        slivers.moveTo(gx, y);
        slivers.lineTo(gx + lean * 1.25, y + drop * 1.25);
      }
      last = bx + bw;
      if (!(sc.searching && !b.match)) {
        ctx.globalAlpha = 0.6 * a;
        ctx.fillStyle = b.item.art.cloth;
        ctx.fillRect(bx, sc.y[i] + 1.5, bw, gt(i) - 3);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = g;
    ctx.fill(lit);
    ctx.fillStyle = grey;
    ctx.fill(dim);
    // Bright slivers where light slips between two books.
    ctx.lineCap = "round";
    ctx.strokeStyle = col(i, 0.55 * a);
    ctx.lineWidth = 3;
    ctx.stroke(slivers);
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * a})`;
    ctx.lineWidth = 1;
    ctx.stroke(slivers);
    ctx.lineCap = "butt";
    if (!lite) {
      // Rippling caustic lines in the pool of light below the shelf.
      const l = Math.max(m.xs - cam, 0);
      const r = Math.min(sc.end - cam, w);
      if (r > l) {
        ctx.lineWidth = 1;
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          for (let x = l; x <= r; x += 14) {
            const wx = x + cam;
            const yy =
              y +
              drop * (0.42 + k * 0.4) +
              Math.sin(wx * 0.021 + sc.t * (1.1 + k * 0.4) + i) * 4 +
              Math.sin(wx * 0.047 - sc.t * 0.8 + k * 2) * 2.5;
            if (x === l) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.strokeStyle = col(i, (0.42 - k * 0.16) * a);
          ctx.stroke();
        }
      }
    }
  }

  // The glass shelves, each carrying its ray along the top surface.
  for (let i = 0; i < 4; i++) {
    const a = sc.wgt[i];
    if (a < 0.02) continue;
    const l = Math.max(m.xs - cam, -20);
    const r = Math.min(sc.end - cam, w + 20);
    if (r <= l) continue;
    const y = sc.y[i];
    const t = gt(i);
    const hot = 1 + sc.boost[i] * 0.8;
    ctx.fillStyle = col(i, 0.2 * a);
    ctx.fillRect(l, y, r - l, t);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(l, y + t * 0.55, r - l, 1);
    ctx.strokeStyle = `rgba(${INK},${0.3 * a})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(l, y + t + 0.35);
    ctx.lineTo(r, y + t + 0.35);
    ctx.stroke();
    ctx.save();
    if (!lite) {
      ctx.shadowColor = col(i, 0.9);
      ctx.shadowBlur = 10 * hot;
    }
    ctx.strokeStyle = col(i, Math.min(1, 0.95 * a));
    ctx.lineWidth = 1.5 * hot;
    ctx.beginPath();
    ctx.moveTo(l, y + 0.5);
    ctx.lineTo(r, y + 0.5);
    ctx.stroke();
    ctx.restore();
    // Pulses of light running down the ray.
    ctx.save();
    ctx.setLineDash([36, 300]);
    ctx.lineDashOffset = -(sc.t * 150 * hot + i * 83) + cam;
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`;
    ctx.lineWidth = 1.5 * hot;
    ctx.beginPath();
    ctx.moveTo(l, y + 0.5);
    ctx.lineTo(r, y + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // The fan: prism to shelves.
  if (nearFirst) {
    for (let i = 0; i < 4; i++) {
      const a = sc.wgt[i];
      if (a < 0.02) continue;
      const e = sx(rays[i].exit);
      const tgt = { x: m.xs - cam, y: sc.y[i] + 0.5 };
      const hot = 1 + sc.boost[i] * 0.8;
      if (!lite) {
        taper(ctx, e, tgt, 3, 9 * hot);
        ctx.fillStyle = col(i, 0.14 * a);
        ctx.fill();
      }
      taper(ctx, e, tgt, 0.8, 0.9 * hot);
      ctx.fillStyle = col(i, a);
      ctx.fill();
    }
  }

  // The far end: rays converge on a mirrored prism and leave as white light.
  const farVisible = sc.end - cam < w + 40;
  let outA: Vec | null = null;
  if (farVisible) {
    const mx = (p: Vec): Vec => ({ x: sc.x2 - (p.x - m.px) - cam, y: p.y });
    for (let i = 0; i < 4; i++) {
      const a = sc.wgt[i];
      if (a < 0.02) continue;
      const from = { x: sc.end - cam, y: sc.y[i] + 0.5 };
      const e = mx(rays[i].exit);
      if (!lite) {
        taper(ctx, from, e, 8, 3);
        ctx.fillStyle = col(i, 0.14 * a);
        ctx.fill();
      }
      taper(ctx, from, e, 0.9, 0.8);
      ctx.fillStyle = col(i, a);
      ctx.fill();
    }
    outA = mx(entry);
  }
  ctx.restore(); // fan reveal clip

  // First prism, with the paths through the glass.
  if (nearFirst) {
    const v = sc.verts.map(sx);
    const c = { x: m.px - cam, y: sc.pcy };
    const lit = sc.beam >= 1 ? Math.min(1, sc.fanP * 6) : 0;
    dial(ctx, c, m.r, v[0]);
    // Colour thrown onto the paper beside the prism's own shadow.
    if (!lite && lit > 0) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = m.r * 0.09;
      for (let i = 0; i < 4; i++) {
        const a = sc.wgt[i] * lit;
        if (a < 0.02) continue;
        const p = rays[i];
        ctx.shadowColor = col(i, 0.5 * a);
        ctx.shadowBlur = 22;
        ctx.strokeStyle = col(i, 0.13 * a);
        ctx.beginPath();
        ctx.moveTo(p.exit.x - cam + 14, p.exit.y + 30);
        ctx.lineTo(
          p.exit.x - cam + 14 + p.dir.x * m.r * 1.3,
          p.exit.y + 30 + p.dir.y * m.r * 1.3,
        );
        ctx.stroke();
      }
      ctx.restore();
    }
    glass(ctx, v, sc.fanP < 1 ? sc.beam * (1 - sc.fanP) : 0, lite);
    if (lit > 0) {
      const e = sx(entry);
      // The part of the beam that never enters: a faint reflection off the
      // first face.
      const face = nearestFace(v, e);
      if (face) {
        const dot = dir.x * face.x + dir.y * face.y;
        const back = {
          x: dir.x - 2 * dot * face.x,
          y: dir.y - 2 * dot * face.y,
        };
        whiteBeam(
          ctx,
          e,
          { x: e.x + back.x * m.r * 0.9, y: e.y + back.y * m.r * 0.9 },
          1.5,
          0.45 * lit,
        );
      }
      // The spectrum spreading inside the glass.
      const first = sx(rays[0].exit);
      const lastExit = sx(rays[3].exit);
      const inner = ctx.createLinearGradient(
        first.x,
        first.y,
        lastExit.x,
        lastExit.y,
      );
      for (let i = 0; i < 4; i++)
        inner.addColorStop(i / 3, col(i, 0.3 * sc.wgt[i] * lit));
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(first.x, first.y);
      ctx.lineTo(lastExit.x, lastExit.y);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = sc.wgt[i] * lit;
        if (a < 0.02) continue;
        const p = rays[i];
        const x = sx(p.exit);
        taper(ctx, e, x, 0.6, lite ? 1.2 : 2.2);
        ctx.fillStyle = col(i, 0.92 * a);
        ctx.fill();
        if (p.glint) {
          const gp = sx(p.glint);
          ctx.strokeStyle = col(i, 0.34 * a);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x.x, x.y);
          ctx.lineTo(gp.x, gp.y);
          ctx.stroke();
          spark(ctx, gp, m.r * 0.09, 0.75 * a);
        }
        spark(ctx, x, m.r * 0.12, 0.95 * a);
      }
      spark(ctx, e, m.r * 0.2, 1);
    }
  }

  // Second prism and the recombined beam.
  if (farVisible && outA) {
    const v = sc.verts.map((p) => ({ x: sc.x2 - (p.x - m.px) - cam, y: p.y }));
    const out = { x: Math.cos(m.beta), y: Math.sin(m.beta) };
    const reach = Math.max(0, (benchBottom - 26 - outA.y) / out.y);
    const land = { x: outA.x + out.x * reach, y: outA.y + out.y * reach };
    whiteBeam(ctx, outA, land, m.phone ? 3 : 4);
    whiteBeam(ctx, land, { x: w + 40, y: land.y }, m.phone ? 3 : 4, 0.9);
    glass(ctx, v, 0, lite);
    for (let i = 0; i < 4; i++) {
      const a = sc.wgt[i];
      if (a < 0.02) continue;
      const p = rays[i];
      ctx.strokeStyle = col(i, 0.85 * a);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sc.x2 - (p.exit.x - m.px) - cam, p.exit.y);
      ctx.lineTo(outA.x, outA.y);
      ctx.stroke();
    }
    spark(ctx, outA, 16, 1);
    spark(ctx, land, 12, 0.9);
  }

  // The pointer as a small lens: a bright spot with a split fringe.
  if (sc.pointer.on && !lite && sc.pointer.y < benchBottom) {
    const { x, y } = sc.pointer;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 74);
    g.addColorStop(0, "rgba(255,255,255,.95)");
    g.addColorStop(0.3, "rgba(255,255,255,.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 74, y - 74, 148, 148);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = col(i, 0.42);
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        40 + i * 2.6,
        sc.t * 0.6 + i * 0.5,
        sc.t * 0.6 + i * 0.5 + Math.PI * 1.25,
      );
      ctx.stroke();
    }
  }
  ctx.restore(); // bench clip

  rail(sc);
}

// The white beam's landing point at the far end, in world coordinates, so
// the footer can stand where the light arrives.
export function landing(
  m: Metrics,
  entry: Vec,
  x2: number,
  benchBottom: number,
) {
  const ax = x2 - (entry.x - m.px);
  const reach = Math.max(0, (benchBottom - 26 - entry.y) / Math.sin(m.beta));
  return {
    x: ax + Math.cos(m.beta) * reach,
    y: entry.y + Math.sin(m.beta) * reach,
  };
}
