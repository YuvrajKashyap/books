// The curved shelves: wall segments, shelf boards and the books standing on
// them. Only the arc that faces the viewer is built.
import { memo, useState, type CSSProperties } from "react";
import { warmNote, type BookArt, type ShelfBook } from "../../shared/catalogue";
import {
  near,
  roman,
  thickness,
  type Dims,
  type Layout,
  type Tier,
} from "./room";

export type Win = { c: number; lo: number; hi: number };
export type Linger = { ids: Set<string>; c: number } | null;

export function plane(
  w: number,
  h: number,
  x: number,
  y: number,
  z: number,
  ry = 0,
  rx = 0,
): CSSProperties {
  return {
    width: w,
    height: h,
    marginLeft: -w / 2,
    marginTop: -h / 2,
    transform: `translate3d(${x}px,${y}px,${z}px) rotateY(${ry}deg) rotateX(${rx}deg)`,
  };
}

type SlotProps = {
  book: ShelfBook;
  art: BookArt;
  ang: number;
  layout: Layout;
  dims: Dims;
  sunk: boolean;
  out: boolean;
  full: boolean;
  tab: boolean;
  wave: number;
  register: (id: string, el: HTMLElement | null) => void;
  onOpen: (book: ShelfBook) => void;
  onPeek: (book: ShelfBook | null) => void;
};

const BookSlot = memo(function BookSlot({
  book,
  art,
  ang,
  layout,
  dims,
  sunk,
  out,
  full,
  tab,
  wave,
  register,
  onOpen,
  onPeek,
}: SlotProps) {
  const [noCover, setNoCover] = useState(false);
  const [noSpine, setNoSpine] = useState(false);
  const w = dims.coverW;
  const h = Math.round(dims.H * art.heightScale);
  const t = thickness(art, dims.u);
  const spines = layout === "spines";
  const cover = art.small ?? art.front;
  return (
    <div
      className={"slot" + (sunk ? " sunk" : "") + (out ? " out" : "")}
      ref={(el) => register(book.id, el)}
      style={
        {
          transform: `rotateY(${-ang}rad) translateZ(${-dims.R}px)`,
          "--wave": wave + "ms",
          "--cloth": art.cloth,
        } as CSSProperties
      }
    >
      <div className="rise">
        <div
          className="vol"
          aria-hidden="true"
          onClick={() => onOpen(book)}
          style={{
            transform: spines
              ? `translateZ(${-w / 2}px) rotateY(90deg)`
              : `translateZ(${-t / 2}px) rotateY(0deg)`,
          }}
        >
          {full && (
            <>
              <span
                className="face back"
                style={plane(w, h, 0, -h / 2, -t / 2, 180)}
              />
              <span
                className="face pages"
                style={plane(t - 2, h - 4, w / 2 - 1.5, -h / 2, 0, 90)}
              />
            </>
          )}
          <span
            className="face head"
            style={plane(w - 3, t - 2, 0, -h + 1.5, 0, 0, 90)}
          />
          <span
            className="face spine"
            style={plane(t, h, -w / 2, -h / 2, 0, -90)}
          >
            <span className="spine-title">{art.title}</span>
            {art.spine && !noSpine && (
              <img
                src={art.spine}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={() => setNoSpine(true)}
              />
            )}
          </span>
          <span className="face front" style={plane(w, h, 0, -h / 2, t / 2)}>
            <span className="front-title">
              {art.title}
              <i>{book.author}</i>
            </span>
            {full && cover && !noCover && (
              <img
                src={cover}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onError={() => setNoCover(true)}
              />
            )}
          </span>
        </div>
        <button
          type="button"
          className="hit"
          data-book={book.id}
          tabIndex={tab ? 0 : -1}
          aria-label={`${art.title} by ${book.author}. Open.`}
          style={{
            width: spines ? t : w,
            height: h,
            marginLeft: -(spines ? t : w) / 2,
            marginTop: -h,
          }}
          onClick={() => onOpen(book)}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") {
              warmNote(book.id);
              onPeek(book);
            }
          }}
          onPointerLeave={() => onPeek(null)}
          onFocus={() => {
            warmNote(book.id);
            onPeek(book);
          }}
          onBlur={() => onPeek(null)}
        />
      </div>
    </div>
  );
});

// The wall behind the books and the boards they stand on, as flat segments
// close enough together to read as a curve.
const Bays = memo(function Bays({
  dims,
  from,
  to,
}: {
  dims: Dims;
  from: number;
  to: number;
}) {
  const { R, sigma, shelfDepth, pitch, H, lip, u } = dims;
  const outer = 2 * (R + shelfDepth) * Math.tan(sigma / 2) + 1.5;
  const inner = 2 * (R - 8) * Math.tan(sigma / 2) + 1.2;
  const base = Math.round(H * 0.53);
  const top = -pitch * 0.92;
  const bottom = 3 * pitch + base + lip + 90 * u;
  const bays = [];
  for (let j = from; j <= to; j++) {
    bays.push(
      <div
        key={j}
        className="bay"
        style={{
          transform: `rotateY(${-j * sigma}rad) translateZ(${-R}px)`,
        }}
      >
        <span
          className="wall"
          style={{
            ...plane(outer, bottom - top, 0, (top + bottom) / 2, -shelfDepth),
            backgroundSize: `100% ${pitch}px, 100% ${pitch}px, ${outer * 3}px auto`,
            backgroundPosition: `0 ${-top + base + lip - pitch}px, 0 ${-top + base + lip - pitch}px, ${-(((j % 3) + 3) % 3) * outer}px 0`,
          }}
        />
        {[-1, 0, 1, 2, 3].map((t) => {
          const y = t * pitch + base;
          return (
            <span key={t}>
              <span
                className="board"
                style={plane(
                  outer,
                  shelfDepth + 10,
                  0,
                  y,
                  (-shelfDepth + 10) / 2,
                  0,
                  90,
                )}
              />
              <span
                className={"lip" + (t < 0 ? " cornice" : "")}
                style={{
                  ...plane(inner, lip, 0, y + lip / 2, 9),
                  backgroundPosition: `0 0, 0 0, ${-(((j % 6) + 6) % 6) * inner}px ${t * 37}px`,
                }}
              />
            </span>
          );
        })}
      </div>,
    );
  }
  return <>{bays}</>;
});

type RingProps = {
  tiers: Tier[];
  dims: Dims;
  layout: Layout;
  win: Win;
  active: number;
  lit: number | null; // the only tier in the light when a category is chosen
  matches: Set<string> | null;
  outId: string | undefined;
  full: boolean;
  frontId: string;
  waveAt: number;
  linger: Linger;
  register: (id: string, el: HTMLElement | null) => void;
  onOpen: (book: ShelfBook) => void;
  onPeek: (book: ShelfBook | null) => void;
};

export const Ring = memo(function Ring({
  tiers,
  dims,
  layout,
  win,
  active,
  lit,
  matches,
  outId,
  full,
  frontId,
  waveAt,
  linger,
  register,
  onOpen,
  onPeek,
}: RingProps) {
  const { phiMount, phiVis, sigma, pitch, H, R, u } = dims;
  const base = Math.round(H * 0.53);
  const from = Math.floor((win.c - phiMount) / sigma);
  const to = Math.ceil((win.c + phiMount) / sigma);
  return (
    <>
      <Bays dims={dims} from={from} to={to} />
      {tiers.map((tier, t) => {
        if (t < win.lo || t > win.hi) return null;
        const slots = [];
        for (let i = 0; i < tier.books.length; i++) {
          const book = tier.books[i];
          let ang = near(tier, tier.angle[i], win.c);
          const off = ang - win.c;
          if (Math.abs(off) > phiMount) {
            if (!linger?.ids.has(book.id)) continue;
            const side = near(tier, tier.angle[i], linger.c) - linger.c;
            ang = linger.c + Math.sign(side || 1) * (phiMount + 0.14);
          }
          slots.push(
            <BookSlot
              key={book.id}
              book={book}
              art={tier.arts[i]}
              ang={ang}
              layout={layout}
              dims={dims}
              sunk={matches !== null && !matches.has(book.id)}
              out={outId === book.id}
              full={full || book.id === frontId}
              tab={t === active && Math.abs(off) < phiVis * 0.94}
              wave={Math.round(
                Math.min(1, Math.abs(ang - waveAt) / phiMount) * 620,
              )}
              register={register}
              onOpen={onOpen}
              onPeek={onPeek}
            />,
          );
        }
        const seam = near(tier, tier.seam, win.c);
        return (
          <div
            key={tier.focus}
            className={
              "tier" +
              (t === active ? " on" : "") +
              (lit !== null && lit !== t ? " off" : "")
            }
            style={{ transform: `translateY(${t * pitch + base}px)` }}
          >
            {Math.abs(seam - win.c) < phiMount && (
              <div
                className="slot seam"
                style={{
                  transform: `rotateY(${-seam}rad) translateZ(${-R}px)`,
                }}
              >
                <div
                  className="plaque"
                  style={{
                    width: 112 * u,
                    height: 150 * u,
                    marginLeft: -56 * u,
                    marginTop: -150 * u,
                  }}
                >
                  <b>{roman[t]}</b>
                  <span>{tier.focus}</span>
                  <i>
                    {tier.books.length}{" "}
                    {tier.books.length === 1 ? "book" : "books"}
                  </i>
                </div>
              </div>
            )}
            {slots}
          </div>
        );
      })}
    </>
  );
});
