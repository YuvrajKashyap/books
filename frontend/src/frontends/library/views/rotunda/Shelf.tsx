// The curved shelves: wall segments, shelf boards and the books standing on
// them. Only the arc that faces the viewer is built.
import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  warmNote,
  type BookArt,
  type ShelfBook,
} from "../../../../shared/catalogue";
import {
  near,
  roman,
  thickness,
  type Dims,
  type Layout,
  type Tier,
} from "./room";
import { cut, grain } from "./wood";

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
  match: boolean;
  out: boolean;
  full: boolean; // build the back and the page edges too
  face: boolean; // put the cover art on the front
  lead: boolean; // the book ahead: fetch its sharpest cover
  spaced: boolean; // face-out on its own stand, in its own light
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
  match,
  out,
  full,
  face,
  lead,
  spaced,
  tab,
  wave,
  register,
  onOpen,
  onPeek,
}: SlotProps) {
  // Which cover file to try: the light one, then the full one, then none.
  const [tried, setTried] = useState(0);
  const [noSharp, setNoSharp] = useState(false);
  const [noSpine, setNoSpine] = useState(false);
  const w = dims.coverW;
  const h = Math.round(dims.H * art.heightScale);
  const t = thickness(art, dims.u);
  const spines = layout === "spines";
  const covers = [art.small, art.front].filter(
    (src, i, all): src is string => Boolean(src) && all.indexOf(src) === i,
  );
  const cover = covers[tried];
  const u = dims.u;
  return (
    <div
      className={
        "slot" +
        (sunk ? " sunk" : "") +
        (match ? " match" : "") +
        (out ? " out" : "")
      }
      ref={(el) => register(book.id, el)}
      style={
        {
          transform: `rotateY(${-ang}rad) translateZ(${-dims.R}px)`,
          "--wave": wave + "ms",
          "--cloth": art.cloth,
        } as CSSProperties
      }
    >
      {spaced && (
        <>
          <span
            className="halo"
            aria-hidden="true"
            style={plane(w * 2.3, h * 1.75, 0, -h * 0.56, -dims.shelfDepth + 3)}
          />
          <span
            className="stand"
            aria-hidden="true"
            style={plane(w * 0.9, 9 * u, 0, -4.5 * u, 5 * u, 0, -10)}
          />
        </>
      )}
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
            {art.spine && !noSpine ? (
              <img
                src={art.spine}
                alt=""
                decoding="async"
                draggable={false}
                onError={() => setNoSpine(true)}
              />
            ) : (
              <span className="spine-title">{art.title}</span>
            )}
          </span>
          <span className="face front" style={plane(w, h, 0, -h / 2, t / 2)}>
            {/* The typeset front is only for a book with no cover art at
                all; a cover that is still loading shows its cloth. */}
            {!cover && (
              <span className="front-title">
                {art.title}
                <i>{book.author}</i>
              </span>
            )}
            {(face || full) && cover && (
              <img
                key={cover}
                src={cover}
                alt=""
                decoding="async"
                draggable={false}
                onError={() => setTried((n) => n + 1)}
              />
            )}
            {lead && art.front && art.front !== cover && !noSharp && (
              <img
                className="sharp"
                src={art.front}
                alt=""
                decoding="async"
                draggable={false}
                onError={() => setNoSharp(true)}
              />
            )}
          </span>
        </div>
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
  );
});

// One wall panel's walnut, cut from the canvas board. Drawn once per panel.
const Grain = memo(function Grain({
  j,
  w,
  h,
}: {
  j: number;
  w: number;
  h: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (ref.current) cut(ref.current, j);
  }, [j, w, h]);
  return (
    <canvas
      ref={ref}
      className="grain"
      width={Math.max(8, Math.ceil(w * 0.8))}
      height={Math.max(8, Math.ceil(h * 0.45))}
      aria-hidden="true"
    />
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
          style={
            {
              ...plane(outer, bottom - top, 0, (top + bottom) / 2, -shelfDepth),
              // Where each tier's band of light and shadow starts.
              "--wy": `${-top + base + lip - pitch}px`,
            } as CSSProperties
          }
        >
          <Grain j={j} w={outer} h={bottom - top} />
        </span>
        {[-1, 0, 1, 2, 3].map((t) => {
          const y = t * pitch + base;
          return (
            <span key={t}>
              <span
                className="board"
                style={{
                  ...plane(
                    outer,
                    shelfDepth + 10,
                    0,
                    y,
                    (-shelfDepth + 10) / 2,
                    0,
                    90,
                  ),
                  backgroundPosition: `0 0, ${-Math.round(grain(j, t + 40) * 900)}px ${-Math.round(grain(j, t + 50) * 900)}px`,
                }}
              />
              <span
                className={"lip" + (t < 0 ? " cornice" : "")}
                style={{
                  ...plane(inner, lip, 0, y + lip / 2, 9),
                  backgroundPosition: `0 0, 0 0, ${-Math.round(grain(j, t + 20) * 1400)}px ${-Math.round(grain(j, t + 30) * 700)}px`,
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
        const lead =
          t === active ? tier.books.findIndex((b) => b.id === frontId) : -1;
        for (let i = 0; i < tier.books.length; i++) {
          const book = tier.books[i];
          let ang = near(tier, tier.angle[i], win.c);
          const off = ang - win.c;
          if (Math.abs(off) > phiMount) {
            if (!linger?.ids.has(book.id)) continue;
            const side = near(tier, tier.angle[i], linger.c) - linger.c;
            ang = linger.c + Math.sign(side || 1) * (phiMount + 0.14);
          }
          const hit = matches !== null && matches.has(book.id);
          slots.push(
            <BookSlot
              key={book.id}
              book={book}
              art={tier.arts[i]}
              ang={ang}
              layout={tier.layout}
              dims={dims}
              sunk={matches !== null && !hit}
              match={hit}
              out={outId === book.id}
              full={full || tier.layout === "covers"}
              // Every book on the tier you stand at carries its cover, so
              // whichever one turns to face you already has it loaded.
              face={t === active || hit}
              lead={i === lead}
              spaced={tier.spaced}
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
        const niche = Math.min(tier.bay * R - 26 * u, 300 * u);
        return (
          <div
            key={tier.focus}
            className={
              "tier " +
              tier.layout +
              (tier.spaced ? " spaced" : "") +
              (t === active ? " on" : "") +
              (t < active ? " above" : t > active ? " below" : "") +
              (lit !== null && lit !== t ? " off" : "")
            }
            style={{ transform: `translateY(${t * pitch + base}px)` }}
          >
            {Math.abs(seam - win.c) < phiMount + 0.2 && (
              <div
                className="slot seam"
                style={{
                  transform: `rotateY(${-seam}rad) translateZ(${-R}px)`,
                }}
              >
                {/* The plate's own bay: an arched niche lit from above. */}
                <span
                  className="niche"
                  aria-hidden="true"
                  style={plane(
                    niche,
                    H * 1.18,
                    0,
                    -H * 0.59,
                    -dims.shelfDepth + 4,
                  )}
                />
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
