// One book standing on a shelf of light: a CSS 3D volume with a flat button on
// its facing side for the keyboard and for assistive tech.
import { memo, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { warmNote } from "../../../../shared/catalogue";
import { BOOK_H, aspectOf, rememberAspect } from "./layout";
import type { Layout, Slot } from "./layout";

export type BookHandlers = {
  register: (id: string, el: HTMLElement | null, delay: number) => void;
  open: (id: string, from: DOMRect) => void;
  target: (id: string | null, viaFocus: boolean) => void;
};

type Props = {
  slot: Slot;
  layout: Layout;
  lite: boolean;
  delay: number;
  away: boolean;
  searching: boolean;
  handlers: BookHandlers;
};

export const ShelfBook = memo(function ShelfBook({
  slot,
  layout,
  lite,
  delay,
  away,
  searching,
  handlers,
}: Props) {
  const { art, book, id } = slot;
  const [aspect, setAspect] = useState(() => aspectOf(id));
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [touched, setTouched] = useState(false);
  const pulled = hover || focus;
  // The fall is an animation; a timer ends it, so a book can never be left
  // hanging above its shelf if the animation does not run.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setLanded(true), delay + 760);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h = Math.round(BOOK_H * art.heightScale * slot.scale);
  const w = Math.round(h * aspect);
  const spines = layout === "spines";
  const cover = lite || w < 118 ? (art.small ?? art.front) : art.front;
  const showFront = !spines || slot.x < 0 || touched;

  const ref = useCallback(
    (el: HTMLDivElement | null) => handlers.register(id, el, delay),
    // The delay is only read on the first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handlers, id],
  );

  const style = {
    transform: `translate3d(${slot.x.toFixed(1)}px,0,${slot.z.toFixed(1)}px) rotateY(${slot.yaw.toFixed(4)}rad)`,
    "--w": w + "px",
    "--h": h + "px",
    "--d": Math.round(art.depth * slot.scale) + "px",
    "--slot": slot.width + "px",
    "--cloth": art.cloth,
  } as CSSProperties;

  const dim = searching && !slot.match;

  return (
    <div
      ref={ref}
      className={
        "gw-slot" +
        (spines ? " is-spine" : "") +
        (pulled ? " is-pulled" : "") +
        (dim ? " is-muted" : "") +
        (searching && slot.match ? " is-heavy" : "") +
        (away ? " is-away" : "") +
        (landed ? " is-landed" : "")
      }
      style={style}
      data-book={id}
      onClick={(e) => {
        const hit = e.currentTarget.querySelector(".gw-hit");
        handlers.open(id, (hit ?? e.currentTarget).getBoundingClientRect());
      }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        setHover(true);
        setTouched(true);
        warmNote(id);
        handlers.target(id, false);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        setHover(false);
        handlers.target(null, false);
      }}
    >
      <i className="gw-plinth" aria-hidden="true" />
      <div className="gw-shift">
        <div className="gw-drop" style={{ animationDelay: delay + "ms" }}>
          <div className="gw-vol">
            {showFront && (
              <div className="gw-face gw-front" aria-hidden="true">
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    draggable={false}
                    decoding="async"
                    onLoad={(e) =>
                      setAspect(rememberAspect(id, e.currentTarget))
                    }
                  />
                ) : (
                  <span className="gw-typeset">
                    <b>{art.title}</b>
                    <em>{book.author}</em>
                  </span>
                )}
              </div>
            )}
            <div className="gw-face gw-spine" aria-hidden="true">
              {spines && art.spine ? (
                <img
                  src={art.spine}
                  alt=""
                  draggable={false}
                  decoding="async"
                />
              ) : spines ? (
                <span className="gw-spine-title">{art.title}</span>
              ) : null}
            </div>
            {spines ? (
              <div className="gw-face gw-back" aria-hidden="true" />
            ) : (
              <div className="gw-face gw-edge" aria-hidden="true" />
            )}
            <div className="gw-face gw-top" aria-hidden="true" />
            <button
              type="button"
              className="gw-hit"
              aria-label={`${art.title} by ${book.author}`}
              onFocus={() => {
                setFocus(true);
                setTouched(true);
                warmNote(id);
                handlers.target(id, true);
              }}
              onBlur={() => {
                setFocus(false);
                handlers.target(null, true);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
