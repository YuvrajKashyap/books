// Bench geometry: where the prism stands, where each glass shelf runs and
// where every book stands on it. All numbers are CSS pixels.
import type { BookArt, ShelfBook } from "../../shared/catalogue";
import { DEG } from "./optics";

// One ray per category, from least to most refracted.
export const RAYS = ["#ee3b2b", "#f2a200", "#00a3ad", "#6b43f2"] as const;
export const RAY_RGB: readonly (readonly [number, number, number])[] = [
  [238, 59, 43],
  [242, 162, 0],
  [0, 163, 173],
  [107, 67, 242],
];
export const WAVELENGTHS = ["640", "585", "495", "430"] as const;

export type Layout = "spines" | "covers";
export type Item = {
  book: ShelfBook;
  art: BookArt;
  shelf: number; // category index, 0 to 3
  hue: number; // sort key along the spectrum, from the binding colour
};
export type Placed = {
  item: Item;
  x: number; // left edge along the shelf, in base units
  pw: number; // projected width on the glass
  w: number;
  h: number;
  d: number;
  match: boolean;
};
export type Shelf = {
  index: number;
  books: Placed[];
  len: number;
  hits: number;
};

export type Metrics = {
  vw: number;
  vh: number;
  phone: boolean;
  hudH: number;
  railH: number;
  benchTop: number;
  benchH: number;
  beta: number; // rise of the incoming beam
  theta0: number; // prism rest rotation
  px: number; // prism centre, world x
  r: number; // prism circumradius
  fan: number; // distance from prism to the first book
  xs: number; // world x where the glass begins
  rows: number;
  slot0: number; // glass height of the first visible shelf
  gap: number; // distance between neighbouring shelves
  h0: number; // base book height with all shelves showing
  hs: number; // book height when one category fills the bench
};

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function measure(vw: number, vh: number): Metrics {
  const phone = vw < 720;
  const hudH = phone ? 116 : 72;
  const railH = phone ? 42 : 50;
  const benchH = Math.max(300, vh - hudH - railH);
  const rows = phone ? 2 : 4;
  // Phones keep the name above two close shelves so the first books stand
  // on the opening screen; desks divide the bench into four.
  const h0 = Math.round(
    phone ? clamp(benchH * 0.23, 110, 150) : Math.min((benchH / 4) * 0.66, 168),
  );
  const gap = phone ? Math.round(h0 * 1.1 + 44) : benchH / 4;
  const slot0 = phone
    ? hudH + Math.round(clamp(benchH * 0.17, 84, 112) + h0 * 1.1)
    : hudH + gap * 0.76;
  const px = phone ? 60 : Math.round(clamp(vw * 0.27, 300, 480));
  const fan = phone ? 210 : Math.round(clamp(vw * 0.46, 480, 700));
  return {
    vw,
    vh,
    phone,
    hudH,
    railH,
    benchTop: hudH,
    benchH,
    beta: (phone ? 42 : 40) * DEG,
    theta0: (phone ? -22 : -23.5) * DEG,
    px,
    r: phone ? 46 : clamp(vh * 0.19, 100, 185),
    fan,
    xs: px + fan,
    rows,
    slot0,
    gap,
    h0,
    hs: Math.round(Math.min(benchH * 0.58, phone ? 300 : 390)),
  };
}
// How wide the fan opens for a given prism rotation, 0.66 to 1.
export function spread(m: Metrics, theta: number) {
  const turned = (m.theta0 - theta) / (10 * DEG);
  return turned > 0 ? 1 - 0.34 * Math.min(1, turned) : 1;
}
export const thetaRange = (m: Metrics): [number, number] => [
  m.theta0 - 10 * DEG,
  m.theta0 + (m.phone ? 5 : 8) * DEG,
];

export type Targets = {
  y: number[]; // glass height per shelf, viewport y
  s: number[]; // scale of each shelf against base units
  shown: boolean[];
  pcy: number; // prism centre y
};

// focus: -1 for all four categories, otherwise the one that fills the bench.
// pair: on phones, which two shelves show when all four are selected.
export function targets(
  m: Metrics,
  focus: number,
  pair: number,
  theta: number,
): Targets {
  const f = spread(m, theta);
  const y: number[] = [];
  const s: number[] = [];
  const shown: boolean[] = [];
  const first = m.phone ? pair * 2 : 0;
  const slot = (k: number) => m.slot0 + m.gap * k;
  const mid = (slot(0) + slot(m.rows - 1)) / 2;
  for (let i = 0; i < 4; i++) {
    const k = i - first;
    y.push(mid + (slot(k) - mid) * f);
    s.push(f);
    shown.push(focus < 0 ? k >= 0 && k < m.rows : i === focus);
  }
  if (focus >= 0) {
    y[focus] = m.benchTop + (m.benchH + m.hs * 1.02) / 2 + (f - 1) * 30;
    s[focus] = (m.hs / m.h0) * (0.82 + 0.18 * f);
  }
  return { y, s, shown, pcy: mid };
}

export const ANGLE: Record<Layout, number> = { spines: 72, covers: 13 };

export function place(
  items: Item[],
  layout: Layout,
  h0: number,
  matches: Set<string> | null,
): { books: Placed[]; len: number; hits: number } {
  const a = ANGLE[layout] * DEG;
  const gap = layout === "spines" ? 6 : 14;
  let x = 0;
  let hits = 0;
  const books = items.map((item) => {
    const h = Math.round(h0 * item.art.heightScale);
    const w = Math.round(h * 0.66);
    const d = Math.max(6, Math.round((item.art.depth * h) / 190));
    const pw = Math.round(w * Math.cos(a) + d * Math.sin(a));
    const match = matches ? matches.has(item.book.id) : true;
    if (match) hits++;
    const placed: Placed = { item, x, pw, w, h, d, match };
    x += pw + gap;
    return placed;
  });
  return { books, len: Math.max(0, x - gap), hits };
}

// Position along the spectrum from a binding colour. Greys go last.
export function hueKey(hex: string) {
  const v = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!v) return 900;
  const n = parseInt(v[1], 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const c = max - min;
  if (c < 0.07) return 720 + (1 - l) * 100;
  let h = 0;
  if (max === r) h = ((g - b) / c) % 6;
  else if (max === g) h = (b - r) / c + 2;
  else h = (r - g) / c + 4;
  h = (h * 60 + 360) % 360;
  // Start the run just before red so crimsons sit with the reds.
  return (h + 20) % 360;
}
