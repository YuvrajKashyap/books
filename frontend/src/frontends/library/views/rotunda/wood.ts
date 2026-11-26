// Walnut, grown on a canvas. One tall board of figured grain is drawn once,
// then every wall panel cuts its own piece from a different place, flipped
// its own way, so no knot ever lines up with another. No image files, no
// data URLs: each panel is a small canvas of its own.

const W = 300;
const H = 1500;
let board: HTMLCanvasElement | null | undefined;

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Smooth value noise on a lattice, enough for grain that wanders.
function noise(seed: number) {
  const rnd = rng(seed);
  const size = 256;
  const table = new Float32Array(size * size);
  for (let i = 0; i < table.length; i++) table[i] = rnd();
  const at = (x: number, y: number) =>
    table[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = fade(x - xi),
      yf = fade(y - yi);
    const a = at(xi, yi),
      b = at(xi + 1, yi),
      c = at(xi, yi + 1),
      d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function grow(): HTMLCanvasElement | null {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  const n1 = noise(7),
    n2 = noise(31),
    n3 = noise(97);
  const rnd = rng(4242);
  // A few knots, placed by hand-rolled chance; the rings bend round them.
  const knots = Array.from({ length: 5 }, () => ({
    x: 40 + rnd() * (W - 80),
    y: 120 + rnd() * (H - 240),
    r: 14 + rnd() * 20,
  }));
  const img = ctx.createImageData(W, H);
  const px = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Flat-sawn rings: distance across the board, pushed about by slow
      // noise along it so they sweep into long arches.
      let u =
        x * 0.045 +
        (n1(x * 0.012, y * 0.0026) - 0.5) * 9 +
        (n2(x * 0.03, y * 0.009) - 0.5) * 1.6 +
        Math.sin(y * 0.0021 + x * 0.004) * 2.2;
      let dark = 0;
      for (const k of knots) {
        const dx = (x - k.x) / k.r,
          dy = (y - k.y) / (k.r * 2.4);
        const d2 = dx * dx + dy * dy;
        if (d2 < 30) {
          const pull = Math.exp(-d2 * 0.35);
          u += pull * Math.sqrt(d2) * 3.2;
          dark += Math.exp(-d2 * 2.2) * 0.75;
        }
      }
      const ring = u - Math.floor(u);
      // Late wood is a thin dark band; early wood is broad and lighter.
      const late = Math.pow(Math.max(0, 1 - Math.abs(ring - 0.82) * 5.5), 1.6);
      // Open pores and fibre: fine streaks running with the board.
      const fibre = n3(x * 0.9, y * 0.02);
      const tone =
        0.56 +
        (n1(x * 0.004 + 50, y * 0.0011) - 0.5) * 0.36 -
        late * 0.42 -
        dark -
        (fibre > 0.78 ? (fibre - 0.78) * 1.3 : 0) +
        (fibre < 0.2 ? (0.2 - fibre) * 0.5 : 0);
      const t = Math.max(0, Math.min(1, tone));
      const i = (y * W + x) * 4;
      // From near-black heartwood to warm chestnut.
      px[i] = 26 + t * 96;
      px[i + 1] = 15 + t * 58;
      px[i + 2] = 8 + t * 30;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function source() {
  if (board === undefined) {
    try {
      board = grow();
    } catch {
      board = null;
    }
  }
  return board;
}

// A steady pseudo-random number in [0, 1) for a panel and a purpose.
export function grain(j: number, salt: number) {
  const x = Math.sin(j * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Paint panel j's piece of the board onto its canvas.
export function cut(cv: HTMLCanvasElement, j: number) {
  const src = source();
  const ctx = cv.getContext("2d");
  if (!src || !ctx) return;
  const w = cv.width,
    h = cv.height;
  // A piece about a third of the board wide and most of it tall.
  const sw = W * (0.28 + grain(j, 11) * 0.14);
  const sh = H * (0.62 + grain(j, 12) * 0.3);
  const sx = grain(j, 13) * (W - sw);
  const sy = grain(j, 14) * (H - sh);
  ctx.save();
  ctx.setTransform(
    grain(j, 15) > 0.5 ? -1 : 1,
    0,
    0,
    grain(j, 16) > 0.5 ? -1 : 1,
    grain(j, 15) > 0.5 ? w : 0,
    grain(j, 16) > 0.5 ? h : 0,
  );
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  ctx.restore();
  // Each board takes the stain a little differently.
  const shade = grain(j, 17);
  ctx.fillStyle =
    shade > 0.5
      ? `rgba(0,0,0,${((shade - 0.5) * 0.36).toFixed(3)})`
      : `rgba(120,64,24,${((0.5 - shade) * 0.18).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
}
