// Ray tracing through a triangular prism in two dimensions. Screen
// coordinates: x to the right, y downward. Every ray drawn on the bench
// obeys Snell's law for the index shown beside it; the spread between
// indices is far wider than any real glass so the fan is legible.
export type Vec = { x: number; y: number };
export type RayPath = {
  entry: Vec;
  exit: Vec;
  dir: Vec; // unit direction after leaving the glass
  glint: Vec | null; // where the partial internal reflection lands
  n: number; // refractive index used for this ray
  solved: boolean; // false when no index reaches the target
};

export const DEG = Math.PI / 180;

export function prismVerts(
  cx: number,
  cy: number,
  r: number,
  theta: number,
): Vec[] {
  return [-90, 30, 150].map((a) => ({
    x: cx + r * Math.cos(a * DEG + theta),
    y: cy + r * Math.sin(a * DEG + theta),
  }));
}

type Hit = { t: number; edge: number; p: Vec; nrm: Vec };

function hit(o: Vec, d: Vec, verts: Vec[], skip: number): Hit | null {
  const cx = (verts[0].x + verts[1].x + verts[2].x) / 3;
  const cy = (verts[0].y + verts[1].y + verts[2].y) / 3;
  let best: Hit | null = null;
  for (let i = 0; i < 3; i++) {
    if (i === skip) continue;
    const a = verts[i];
    const b = verts[(i + 1) % 3];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = d.x * ey - d.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den;
    const u = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / den;
    if (t < 1e-6 || u < 0 || u > 1) continue;
    if (best && best.t <= t) continue;
    const len = Math.hypot(ex, ey);
    let nx = ey / len;
    let ny = -ex / len;
    if (nx * (a.x - cx) + ny * (a.y - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    best = {
      t,
      edge: i,
      p: { x: o.x + d.x * t, y: o.y + d.y * t },
      nrm: { x: nx, y: ny },
    };
  }
  return best;
}

// d is a unit direction, n a unit normal facing against it, eta = n1 / n2.
function refract(d: Vec, n: Vec, eta: number): Vec | null {
  const cosi = -(d.x * n.x + d.y * n.y);
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const f = eta * cosi - Math.sqrt(k);
  return { x: eta * d.x + f * n.x, y: eta * d.y + f * n.y };
}

type Traced = { entry: Vec; exit: Vec; dir: Vec | null; glint: Vec | null };

export function trace(
  o: Vec,
  d: Vec,
  verts: Vec[],
  index: number,
): Traced | null {
  const h1 = hit(o, d, verts, -1);
  if (!h1) return null;
  const inside = refract(d, h1.nrm, 1 / index);
  if (!inside) return null;
  const h2 = hit(h1.p, inside, verts, h1.edge);
  if (!h2) return null;
  const out = refract(inside, { x: -h2.nrm.x, y: -h2.nrm.y }, index);
  const dot = inside.x * h2.nrm.x + inside.y * h2.nrm.y;
  const back = {
    x: inside.x - 2 * dot * h2.nrm.x,
    y: inside.y - 2 * dot * h2.nrm.y,
  };
  const h3 = hit(h2.p, back, verts, h2.edge);
  return { entry: h1.p, exit: h2.p, dir: out, glint: h3 ? h3.p : null };
}

function yAt(tr: Traced | null, x: number): number {
  if (!tr || !tr.dir || tr.dir.x < 0.06) return Infinity;
  return tr.exit.y + (tr.dir.y / tr.dir.x) * (x - tr.exit.x);
}

// Finds the index whose ray leaves the prism and crosses the line x = tx at
// height ty. A higher index bends the ray further down the screen, so the
// search is a plain bisection.
export function solveRay(
  o: Vec,
  d: Vec,
  verts: Vec[],
  tx: number,
  ty: number,
): RayPath {
  let lo = 1.0005;
  let hi = 2.4;
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2;
    if (yAt(trace(o, d, verts, mid), tx) > ty) hi = mid;
    else lo = mid;
  }
  const tr = trace(o, d, verts, lo);
  if (tr && tr.dir && Math.abs(yAt(tr, tx) - ty) < 2.5)
    return {
      entry: tr.entry,
      exit: tr.exit,
      dir: tr.dir,
      glint: tr.glint,
      n: lo,
      solved: true,
    };
  // No glass reaches that height. Fall back to a straight run from the
  // exit face so the bench still reads; the readout marks it unsolved.
  const base = trace(o, d, verts, 1.5);
  const entry = base
    ? base.entry
    : { x: (verts[0].x + verts[2].x) / 2, y: (verts[0].y + verts[2].y) / 2 };
  const exit = base
    ? base.exit
    : { x: (verts[0].x + verts[1].x) / 2, y: (verts[0].y + verts[1].y) / 2 };
  const len = Math.hypot(tx - exit.x, ty - exit.y) || 1;
  return {
    entry,
    exit,
    dir: { x: (tx - exit.x) / len, y: (ty - exit.y) / len },
    glint: base ? base.glint : null,
    n: 1.5,
    solved: false,
  };
}
