// The case: books packed onto shelves as real boxes with a cloth spine, a
// jacket on the side and a shadow thrown on the wall behind. Shelves far
// from the viewport keep only bare buttons so tab order survives.
import {
  memo,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { warmNote, type BookArt, type ShelfBook } from "../../shared/catalogue";
import type { Lamp, SceneShelf } from "./lamp";

export type Layout = "spines" | "covers";
export type Placed = {
  book: ShelfBook;
  art: BookArt;
  x: number; // left edge inside the row
  w: number; // the slot it stands in
  h: number;
  t: number; // spine thickness
  cw: number; // cover width
  set: number; // how far it is pushed back
  col: number;
  fs: number; // spine lettering size
};
export type Packing = {
  rows: Placed[][];
  shelfH: number;
  bookH: number;
  boardH: number;
  width: number;
};

const setbacks = [0, 0, 5, 9, 13, 2, 0, 7];
function hash(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return n;
}

// Stand every book on a shelf. Positions are worked out here, not by the
// browser, so the lamp can light each book without measuring it.
export function pack(
  order: ShelfBook[],
  arts: Map<string, BookArt>,
  width: number,
  layout: Layout,
): Packing {
  const wide = width >= 1000;
  const mid = width >= 640;
  const covers = layout === "covers";
  const bookH = covers
    ? wide
      ? 226
      : mid
        ? 190
        : 128
    : wide
      ? 250
      : mid
        ? 210
        : 164;
  const pad = mid ? 16 : 8;
  const boardH = mid ? 18 : 14;
  const head = mid ? 30 : 22;
  const shelfH = Math.round(bookH * 1.1) + head + boardH;
  const minGap = covers ? (mid ? 14 : 8) : 1;
  const maxGap = covers ? 46 : 5;
  const avail = Math.max(120, width - pad * 2);
  const rows: Placed[][] = [];
  let row: Placed[] = [];
  let used = 0;
  for (const book of order) {
    const art = arts.get(book.id);
    if (!art) continue;
    const h = Math.round(bookH * art.heightScale);
    const t = Math.max(mid ? 13 : 11, Math.round((art.depth * bookH) / 190));
    const cw = Math.round(h * 0.665);
    const w = covers ? cw : t;
    if (row.length && used + minGap + w > avail) {
      rows.push(row);
      row = [];
      used = 0;
    }
    used += (row.length ? minGap : 0) + w;
    row.push({
      book,
      art,
      x: 0,
      w,
      h,
      t,
      cw,
      set: covers ? 0 : setbacks[hash(book.id) % setbacks.length],
      col: row.length,
      fs: Math.max(7, Math.min(mid ? 18 : 14, Math.round(t * 0.52))),
    });
  }
  if (row.length) rows.push(row);
  rows.forEach((r, i) => {
    const sum = r.reduce((n, p) => n + p.w, 0);
    const slack = avail - sum;
    const last = i === rows.length - 1 && rows.length > 1;
    const gap =
      r.length > 1
        ? Math.min(maxGap, last ? minGap : slack / (r.length - 1))
        : 0;
    const span = sum + gap * (r.length - 1);
    let x = pad + (last ? 0 : (avail - span) / 2);
    for (const p of r) {
      p.x = Math.round(x * 10) / 10;
      x += p.w + gap;
    }
  });
  return { rows, shelfH, bookH, boardH, width };
}

type Props = {
  packing: Packing;
  layout: Layout;
  matchIds: Set<string> | null; // null when nothing is being searched
  leaving: string | null; // the category about to be the only one left
  outId: string | null; // the book that is off the shelf, in the reader
  lampRef: RefObject<Lamp | null>;
  bookEls: RefObject<Map<string, HTMLDivElement>>;
  rootRef: RefObject<HTMLDivElement | null>;
  onOpen: (id: string) => void;
  onPeek: (el: HTMLElement | null, title?: string, author?: string) => void;
};

export const Bookcase = memo(function Bookcase({
  packing,
  layout,
  matchIds,
  leaving,
  outId,
  lampRef,
  bookEls,
  rootRef,
  onOpen,
  onPeek,
}: Props) {
  const { rows, shelfH, bookH, boardH } = packing;
  const [near, setNear] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4]));
  const shelfEls = useRef<(HTMLDivElement | null)[]>([]);

  // Which shelves are close enough to deserve real books.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setNear(new Set(rows.map((_, i) => i)));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        setNear((old) => {
          const next = new Set(old);
          let changed = false;
          for (const e of entries) {
            const i = Number((e.target as HTMLElement).dataset.shelf);
            if (e.isIntersecting && !next.has(i)) {
              next.add(i);
              changed = true;
            } else if (!e.isIntersecting && next.has(i)) {
              next.delete(i);
              changed = true;
            }
          }
          return changed ? next : old;
        });
      },
      { rootMargin: "55% 0px 55% 0px" },
    );
    shelfEls.current
      .slice(0, rows.length)
      .forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [rows.length, shelfH]);

  // Hand the lamp the books it may light.
  useEffect(() => {
    const lamp = lampRef.current;
    const root = rootRef.current;
    if (!lamp || !root) return;
    const shelves: SceneShelf[] = [];
    rows.forEach((row, index) => {
      const el = shelfEls.current[index];
      if (!el || !near.has(index)) return;
      const rowEl = el.querySelector<HTMLElement>(".row");
      if (!rowEl) return;
      shelves.push({
        row: rowEl,
        shadeEl: el.querySelector<HTMLElement>(".shelf-shade"),
        glintEl: el.querySelector<HTMLElement>(".board-glint"),
        index,
        up: -1,
        shade: -1,
        bx: -9999,
        bi: -1,
        books: row.flatMap((p, i) => {
          const b = bookEls.current.get(p.book.id);
          if (!b) return [];
          return [
            {
              el: b,
              cx: p.x + p.w / 2,
              set: p.set,
              l: i ? row[i - 1].set : -8,
              r: i < row.length - 1 ? row[i + 1].set : -8,
              dx: 9,
              gl: -1,
              sa: -1,
              sd: 0,
              lit: true,
            },
          ];
        }),
      });
    });
    lamp.setScene({ root, shelfH, bookH, boardH, shelves });
    return () => lamp.setScene(null);
  }, [rows, near, layout, shelfH, bookH, boardH, lampRef, rootRef, bookEls]);

  const covers = layout === "covers";
  return (
    <div
      className="shelves"
      ref={rootRef}
      style={
        {
          "--shelf-h": shelfH + "px",
          "--board-h": boardH + "px",
        } as CSSProperties
      }
    >
      {rows.map((row, index) => {
        const real = near.has(index);
        return (
          <div
            className="shelf"
            key={index}
            data-shelf={index}
            ref={(el) => {
              shelfEls.current[index] = el;
            }}
          >
            <div className="shelf-wall" aria-hidden="true" />
            <div className="row">
              {row.map((p) => {
                const { book, art } = p;
                const dim = matchIds !== null && !matchIds.has(book.id);
                const cls =
                  "bk" +
                  (dim ? " is-dim" : matchIds ? " is-match" : "") +
                  (leaving !== null && book.focus !== leaving
                    ? " is-leaving"
                    : "") +
                  (outId === book.id ? " is-out" : "");
                const src =
                  covers && p.cw >= 130 ? art.front : (art.small ?? art.front);
                return (
                  <div
                    key={book.id}
                    className={cls}
                    ref={(el) => {
                      if (el) bookEls.current.set(book.id, el);
                      else bookEls.current.delete(book.id);
                    }}
                    style={
                      {
                        left: p.x,
                        width: p.w,
                        height: p.h,
                        "--t": p.t + "px",
                        "--cw": p.cw + "px",
                        "--set": p.set + "px",
                        "--i": p.col,
                        "--fs": p.fs + "px",
                        "--cloth": art.cloth,
                        "--head": shelfH - boardH - p.h + "px",
                      } as CSSProperties
                    }
                    onPointerEnter={(e) => {
                      if (e.pointerType !== "mouse") return;
                      warmNote(book.id);
                      onPeek(e.currentTarget, art.title, book.author);
                    }}
                    onPointerLeave={() => onPeek(null)}
                  >
                    {real ? (
                      <>
                        <span className="bk-cast" />
                        <span className="bk-box">
                          <span
                            className={
                              "f f-spine" + (art.spine ? " has-art" : "")
                            }
                          >
                            {art.spine && (
                              <img
                                className="sp"
                                src={art.spine}
                                alt=""
                                decoding="async"
                                draggable={false}
                              />
                            )}
                            <span className="warm" />
                            <span className="gilt">
                              <span className="gt">{art.title}</span>
                              {p.t >= 22 && (
                                <span className="ga">{book.author}</span>
                              )}
                            </span>
                            <span className="glint" />
                            <span className="nook" />
                          </span>
                          <span className="f f-cover">
                            {src ? (
                              <img
                                src={src}
                                alt=""
                                decoding="async"
                                draggable={false}
                              />
                            ) : (
                              <span className="f-plain">{art.title}</span>
                            )}
                            <span className="glint" />
                          </span>
                          {covers ? (
                            <span className="f f-edge" />
                          ) : (
                            <span className="f f-back" />
                          )}
                        </span>
                      </>
                    ) : (
                      <span className="bk-flat" />
                    )}
                    {/* The 3D box is drawn by spans; this flat button in
                        front of it takes the click, the focus and the name. */}
                    <button
                      type="button"
                      className="bk-hit"
                      aria-label={art.title + " by " + book.author}
                      onClick={() => onOpen(book.id)}
                      onFocus={(e) => {
                        const slot = e.currentTarget.parentElement;
                        if (slot && e.currentTarget.matches(":focus-visible")) {
                          warmNote(book.id);
                          onPeek(slot, art.title, book.author);
                        }
                      }}
                      onBlur={() => onPeek(null)}
                    />
                  </div>
                );
              })}
            </div>
            <div className="shelf-shade" aria-hidden="true" />
            <div className="board" aria-hidden="true">
              <span className="board-glint" />
              <span className="board-no">
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
