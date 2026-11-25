// Where every book sits on the sheet. Pure geometry: the drawing (canvas) and
// the real shelf (DOM) both read the same plan, which is what keeps the two
// layers registered.
import {
  focuses,
  searchShelf,
  sortShelf,
  sorts,
  type BookArt,
  type Focus,
  type ShelfBook,
  type Sort,
} from "../../shared/catalogue";

export type Mode = "spines" | "covers";
export type Entry = {
  book: ShelfBook;
  art: BookArt;
  active: boolean;
  no: number; // place in the owner's shelf order, from 1
  cat: number; // index into focuses
};
export type Section = {
  key: string;
  tag: string;
  title: string;
  note: string;
  live: boolean;
  entries: Entry[];
};
export type Slot = Entry & {
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  label: string[];
  fs: number;
};
export type Row = {
  n: number;
  y: number; // top of the dimension zone
  top: number; // top of the case interior
  base: number; // shelf surface
  board: number;
  x0: number;
  x1: number;
  from: number;
  to: number; // exclusive
  pages: number;
  known: number;
  live: boolean;
};
export type Head = Omit<Section, "entries"> & { y: number; count: number };
export type Plan = {
  width: number;
  height: number;
  mode: Mode;
  compact: boolean;
  unit: number;
  slots: Slot[];
  rows: Row[];
  heads: Head[];
};

export const letters = ["A", "B", "C", "D"] as const;
export const maxDepth = 62;

export function isFocus(v: string | null): v is Focus {
  return focuses.includes(v as Focus);
}
export function isSort(v: string | null): v is Sort {
  return sorts.some((s) => s.value === v);
}

// Filters never remove a book from the sheet. They decide which books are
// inked and which fall back to construction lines, and they re-plot the order
// so the inked ones come first.
export function sectionsFor(
  books: ShelfBook[],
  arts: Map<string, BookArt>,
  query: string,
  focus: Focus | null,
  sort: Sort,
): Section[] {
  const q = query.trim();
  const hits = new Set(searchShelf(books, q).map((b) => b.id));
  const order = new Map(books.map((b, i) => [b.id, i + 1]));
  const entry = (book: ShelfBook): Entry => ({
    book,
    art: arts.get(book.id)!,
    no: order.get(book.id) ?? 0,
    cat: Math.max(0, focuses.indexOf(book.focus as Focus)),
    active: hits.has(book.id) && (!focus || book.focus === focus),
  });
  const sorted = sortShelf(books, sort).map(entry);
  const sortLabel = sorts.find((s) => s.value === sort)?.label ?? "";
  const inkedFirst = (list: Entry[]) => [
    ...list.filter((e) => e.active),
    ...list.filter((e) => !e.active),
  ];
  const vols = (n: number) => n + (n === 1 ? " volume" : " volumes");

  if (focus) {
    const names = [focus, ...focuses.filter((f) => f !== focus)];
    return names.map((name) => {
      const list = sorted.filter((e) => e.book.focus === name);
      const inked = list.filter((e) => e.active).length;
      const live = name === focus;
      return {
        key: name,
        tag: "Elevation " + letters[focuses.indexOf(name)],
        title: name,
        live,
        note: !live
          ? vols(list.length) + ", construction lines only"
          : q
            ? inked + " of " + list.length + " inked"
            : vols(list.length) + ", inked",
        entries: inkedFirst(list),
      };
    });
  }
  if (q) {
    const on = sorted.filter((e) => e.active);
    const off = sorted.filter((e) => !e.active);
    const out: Section[] = [];
    if (on.length)
      out.push({
        key: "hits",
        tag: "Elevation 01",
        title: "Matches for “" + q + "”",
        note: vols(on.length) + ", inked",
        live: true,
        entries: on,
      });
    out.push({
      key: "rest",
      tag: on.length ? "Elevation 02" : "Elevation 01",
      title: on.length ? "The remainder" : "The whole shelf",
      note: vols(off.length) + ", construction lines only",
      live: false,
      entries: off,
    });
    return out;
  }
  return [
    {
      key: "all",
      tag: "Elevation 01",
      title: "General arrangement",
      note: vols(sorted.length) + ", " + sortLabel.toLowerCase(),
      live: true,
      entries: sorted,
    },
  ];
}

function wrap(text: string, perLine: number, maxLines: number) {
  const words = text.toUpperCase().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length <= perLine || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const cut = lines.slice(0, maxLines).map((l) => l.slice(0, perLine));
  if (lines.length > maxLines && cut.length)
    cut[cut.length - 1] =
      cut[cut.length - 1].slice(0, Math.max(1, perLine - 1)) + "…";
  return cut;
}

export function plan(
  sections: Section[],
  width: number,
  mode: Mode,
  compact: boolean,
): Plan {
  const pad = compact ? 7 : 16;
  const headH = compact ? 62 : 74;
  const dimH = compact ? 30 : 40;
  const board = compact ? 9 : 12;
  const after = compact ? 12 : 20;
  const gap = mode === "spines" ? (compact ? 1 : 2) : compact ? 8 : 16;
  const inner = Math.max(120, width - pad * 2);
  let unit = compact ? 150 : 212;
  let perRow = 0;
  let coverW = 0;
  if (mode === "covers") {
    perRow = compact
      ? inner < 300
        ? 3
        : 4
      : Math.max(4, Math.floor((inner + gap) / (116 + gap)));
    coverW = (inner - gap * (perRow - 1)) / perRow;
    unit = coverW / 0.66;
  }
  const zone = Math.ceil(unit * 1.08);
  const slots: Slot[] = [];
  const rows: Row[] = [];
  const heads: Head[] = [];
  let y = 0;

  const shelve = (items: Entry[], widths: number[], last: boolean) => {
    const used = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    const spare = inner - used;
    const extra =
      mode === "spines" && !last && items.length > 1
        ? Math.min(spare / (items.length - 1), 6)
        : 0;
    const base = y + dimH + zone;
    const from = slots.length;
    let x = pad;
    let pages = 0;
    let known = 0;
    let live = false;
    items.forEach((e, j) => {
      const w = widths[j];
      const h = Math.round(unit * e.art.heightScale);
      let label: string[] = [];
      let fs = 0;
      if (mode === "spines") {
        fs = Math.max(6, Math.min(9.5, w * 0.4));
        if (w >= 11)
          label = [
            e.art.title
              .toUpperCase()
              .slice(0, Math.max(3, Math.floor((h - 22) / (fs * 0.68)))),
          ];
      } else {
        fs = compact ? 6.5 : 7.5;
        const per = Math.max(6, Math.floor((w - 16) / (fs * 0.66)));
        label = wrap(e.art.title, per, 4);
        label.push("");
        label.push(...wrap(e.book.author, per, 1));
      }
      slots.push({
        ...e,
        i: slots.length,
        x: Math.round(x * 2) / 2,
        y: base - h,
        w,
        h,
        row: rows.length,
        label,
        fs,
      });
      x += w + gap + extra;
      if (e.art.pages) {
        pages += e.art.pages;
        known++;
      }
      if (e.active) live = true;
    });
    const end = slots[slots.length - 1];
    rows.push({
      n: rows.length + 1,
      y,
      top: base - zone - 6,
      base,
      board,
      x0: pad,
      x1: end.x + end.w,
      from,
      to: slots.length,
      pages,
      known,
      live,
    });
    y = base + board + after;
  };

  for (const sec of sections) {
    if (!sec.entries.length) continue;
    heads.push({
      key: sec.key,
      tag: sec.tag,
      title: sec.title,
      note: sec.note,
      live: sec.live,
      y,
      count: sec.entries.length,
    });
    y += headH;
    if (mode === "covers") {
      for (let i = 0; i < sec.entries.length; i += perRow) {
        const items = sec.entries.slice(i, i + perRow);
        shelve(
          items,
          items.map(() => coverW),
          i + perRow >= sec.entries.length,
        );
      }
    } else {
      let items: Entry[] = [];
      let widths: number[] = [];
      let x = 0;
      for (const e of sec.entries) {
        const w = Math.max(7, Math.round((e.art.depth * unit) / 190));
        if (items.length && x + w > inner) {
          shelve(items, widths, false);
          items = [];
          widths = [];
          x = 0;
        }
        items.push(e);
        widths.push(w);
        x += w + gap;
      }
      if (items.length) shelve(items, widths, true);
    }
    y += compact ? 10 : 18;
  }
  return {
    width,
    height: Math.max(y, 200),
    mode,
    compact,
    unit,
    slots,
    rows,
    heads,
  };
}
