// Where every book stands on the fabric, how heavy it is, and the one camera
// the DOM books and the WebGL fabric both look through.
import type { BookArt, ShelfBook } from "../../shared/catalogue";

export const BOOK_H = 190; // world px for an average book
export const PITCH_X = 164; // slot width when covers face out
export const ROW_GAP = 760; // world px between shelves, in depth
export const STEP = 380; // page scroll px that carry the camera one shelf
export const NEAR = 900; // distance from the eye to the shelf it is visiting
export const EYE_H = 520; // eye height above the fabric
export const TILT = 0.42; // camera pitch in radians, looking down
export const OVERRUN = 1.35; // shelves of empty fabric after the last one

export type Layout = "covers" | "spines";

export type Entry = { book: ShelfBook; art: BookArt; match: boolean };

export type Slot = {
  id: string;
  book: ShelfBook;
  art: BookArt;
  index: number;
  row: number;
  col: number;
  x: number;
  z: number;
  yaw: number; // radians, turns the book to face the focus of an orbit
  width: number; // slot width along the shelf
  scale: number; // spines are shown a little larger than covers
  match: boolean;
  well: number; // depth of the dent in world px at full mass
  sigma: number; // radius of the dent
};

// One shelf's real totals, printed on its edge label.
export type ShelfMark = {
  row: number;
  x: number;
  z: number;
  yaw: number;
  count: number;
  pages: number;
  measured: number;
};

export const SPINE_SCALE = 1.22;

export type Plan = {
  slots: Slot[];
  marks: ShelfMark[];
  byId: Map<string, Slot>;
  rows: number;
  cols: number;
};

// Mass comes from the real page count. A book with no known count falls back
// to the thickness its jacket was drawn with.
export function massPages(art: BookArt) {
  return art.pages ?? Math.round(Math.max(60, (art.depth - 5) / 0.057));
}

const ORBITS = [2700, 2300, 2000, 1750];

export function planShelf(
  entries: Entry[],
  opts: { cols: number; layout: Layout; orbit: number },
): Plan {
  const { cols, layout } = opts;
  const radius = opts.orbit >= 0 ? ORBITS[opts.orbit % ORBITS.length] : 0;
  const rowWidth = cols * PITCH_X;
  const slots: Slot[] = [];

  // Split into shelves first, then centre each shelf.
  const shelves: { entry: Entry; width: number }[][] = [];
  let shelf: { entry: Entry; width: number }[] = [];
  let used = 0;
  for (const entry of entries) {
    const width =
      layout === "spines"
        ? Math.round(entry.art.depth * SPINE_SCALE) + 7
        : PITCH_X;
    if (shelf.length && used + width > rowWidth + 0.5) {
      shelves.push(shelf);
      shelf = [];
      used = 0;
    }
    shelf.push({ entry, width });
    used += width;
  }
  if (shelf.length) shelves.push(shelf);

  const marks: ShelfMark[] = [];
  shelves.forEach((items, row) => {
    const total = items.reduce((n, it) => n + it.width, 0);
    let cursor = -total / 2;
    const mark: ShelfMark = {
      row,
      x: -total / 2,
      z: -row * ROW_GAP,
      yaw: 0,
      count: items.length,
      pages: 0,
      measured: 0,
    };
    marks.push(mark);
    items.forEach((it, col) => {
      const x = cursor + it.width / 2;
      cursor += it.width;
      const pages = massPages(it.entry.art);
      if (it.entry.art.pages) {
        mark.pages += it.entry.art.pages;
        mark.measured++;
      }
      const heavy = Math.min(1300, Math.max(80, pages));
      let z = -row * ROW_GAP;
      let yaw = 0;
      if (radius) {
        const cx = Math.max(-radius * 0.9, Math.min(radius * 0.9, x));
        z += radius - Math.sqrt(radius * radius - cx * cx);
        yaw = -Math.asin(cx / radius);
      }
      if (col === 0) {
        mark.z = z;
        mark.yaw = yaw;
      }
      slots.push({
        id: it.entry.book.id,
        book: it.entry.book,
        art: it.entry.art,
        index: slots.length,
        row,
        col,
        x,
        z,
        yaw,
        width: it.width,
        scale: layout === "spines" ? SPINE_SCALE : 1,
        match: it.entry.match,
        well: layout === "spines" ? heavy * 0.1 : heavy * 0.15,
        sigma: layout === "spines" ? 80 : 92 + heavy * 0.04,
      });
    });
  });

  const byId = new Map<string, Slot>();
  for (const s of slots) byId.set(s.id, s);
  return { slots, marks, byId, rows: shelves.length, cols };
}

// ---- camera ---------------------------------------------------------------
// World space uses CSS conventions: x right, y down, z toward the viewer. The
// fabric is the plane y = 0.

export type Camera = {
  P: number; // CSS perspective distance in px
  pitch: number;
  eyeH: number;
  ez: number;
};

export function project(cam: Camera, x: number, y: number, z: number) {
  const ry = y + cam.eyeH;
  const rz = z - cam.ez;
  const c = Math.cos(cam.pitch);
  const s = Math.sin(cam.pitch);
  const depth = ry * s - rz * c;
  if (depth < 1) return null;
  const scale = cam.P / depth;
  return { x: x * scale, y: (ry * c + rz * s) * scale, scale };
}

// Where the ray through a screen point (px from the perspective origin) meets
// the fabric. Null when the point is above the horizon.
export function toFabric(cam: Camera, sx: number, sy: number) {
  const c = Math.cos(cam.pitch);
  const s = Math.sin(cam.pitch);
  const dy = sy * c + cam.P * s;
  if (dy <= 1) return null;
  const t = Math.min(9, cam.eyeH / dy);
  return { x: t * sx, z: cam.ez + t * (sy * s - cam.P * c) };
}

export function viewFor(w: number, h: number) {
  // A phone looks through a longer lens, so three covers fill its width.
  const narrow = w < 760;
  const P = Math.max(
    600,
    Math.min(1150, Math.min(w * (narrow ? 1.98 : 0.95), h * 1.3)),
  );
  const originY = Math.round(h * 0.6);
  const rails = w >= 900 ? 400 : 12;
  const nearScale = P / (EYE_H * Math.sin(TILT) + NEAR * Math.cos(TILT));
  const cols = Math.max(
    2,
    Math.min(8, Math.floor((w - rails) / (PITCH_X * nearScale))),
  );
  return { P, originY, cols };
}

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Remembered cover proportions, so a book keeps its shape between mounts.
const aspects = new Map<string, number>();
export function aspectOf(id: string) {
  return aspects.get(id) ?? 0.66;
}
export function rememberAspect(id: string, img: HTMLImageElement) {
  if (!img.naturalWidth || !img.naturalHeight) return aspectOf(id);
  const a = clamp(img.naturalWidth / img.naturalHeight, 0.54, 0.8);
  aspects.set(id, a);
  return a;
}

export const focusSlug = (focus: string) =>
  focus.split(/[^A-Za-z]/)[0].toLowerCase();

export const pad = (n: number, width = 2) => String(n).padStart(width, "0");
export const signed = (n: number, width = 4) =>
  (n < 0 ? "-" : "+") + String(Math.abs(Math.round(n))).padStart(width, "0");
