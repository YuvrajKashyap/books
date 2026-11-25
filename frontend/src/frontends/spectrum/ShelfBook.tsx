// One book standing on the glass: a front board and a spine, turned in 3D.
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { warmNote } from "../../shared/catalogue";
import { ANGLE, type Layout, type Placed } from "./layout";

type Props = {
  p: Placed;
  layout: Layout;
  big: boolean; // drawn large enough to need the full cover
  ghost: boolean; // outside the current search: a graphite line drawing
  away: boolean; // off the glass, in the reader
  wave: number; // seconds of delay so a change ripples down the shelf
  enter: number; // seconds of delay for the first arrival, -1 for none
  onOpen: (id: string) => void;
  onHot: (text: string) => void;
};

// Art fades in over the cloth once it has arrived. Books are only mounted
// near the view, so every image is fetched straight away.
function Art({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [here, setHere] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete) setHere(true);
  }, []);
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      loading="eager"
      decoding="async"
      draggable={false}
      data-loading={!here || undefined}
      onLoad={() => setHere(true)}
      onError={() => setHere(true)}
    />
  );
}

function ShelfBook({
  p,
  layout,
  big,
  ghost,
  away,
  wave,
  enter,
  onOpen,
  onHot,
}: Props) {
  const { art, book } = p.item;
  const cover = big ? (art.front ?? art.small) : (art.small ?? art.front);
  const style = {
    transform: `translate3d(${p.x}px,0,0)`,
    width: p.pw,
    height: p.h,
    "--w": p.w + "px",
    "--h": p.h + "px",
    "--d": p.d + "px",
    "--off": (p.pw - p.w) / 2 + "px",
    "--a": ANGLE[layout] + "deg",
    "--peek": (layout === "spines" ? 40 : 0) + "deg",
    "--cloth": art.cloth,
    "--wave": wave.toFixed(3) + "s",
    animationDelay: enter >= 0 ? enter.toFixed(3) + "s" : undefined,
  } as CSSProperties;
  const label = art.title + " by " + book.author;
  return (
    <button
      type="button"
      className="sp-book"
      data-id={book.id}
      data-ghost={ghost || undefined}
      data-away={away || undefined}
      data-enter={enter >= 0 || undefined}
      style={style}
      aria-label={label}
      onClick={() => onOpen(book.id)}
      onPointerEnter={() => {
        warmNote(book.id);
        onHot(art.title + " · " + book.author);
      }}
      onPointerLeave={() => onHot("")}
      onFocus={() => {
        warmNote(book.id);
        onHot(art.title + " · " + book.author);
      }}
      onBlur={() => onHot("")}
    >
      <span className="sp-box" aria-hidden="true">
        <span className="sp-face sp-front">
          {cover ? (
            <Art key={cover} src={cover} />
          ) : (
            <span className="sp-blank">{art.title}</span>
          )}
        </span>
        <span className="sp-face sp-spine">
          {art.spine ? <Art key={art.spine} src={art.spine} /> : null}
        </span>
      </span>
      <span className="sp-tag" aria-hidden="true">
        <em>{art.title}</em>
        <small>{book.author}</small>
      </span>
    </button>
  );
}

export default memo(ShelfBook);
