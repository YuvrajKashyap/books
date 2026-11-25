// The reader: the chosen book falls out of its shelf toward the viewer, and
// what is known about it prints beneath like an instrument readout.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useNote } from "../../shared/catalogue";
import type { BookArt, ShelfBook } from "../../shared/catalogue";
import { Jacket } from "./Jacket";
import type { Pose } from "./Jacket";
import { clamp, pad } from "./layout";
import type { Layout, Slot } from "./layout";
import type { Probe } from "./Stage";

type Neighbour = { id: string; title: string } | undefined;

type Props = {
  book: ShelfBook;
  art: BookArt;
  slot: Slot | undefined;
  layout: Layout;
  closing: boolean;
  still: boolean;
  origin: DOMRect | null;
  returnRect: () => DOMRect | null;
  prev: Neighbour;
  next: Neighbour;
  probe: RefObject<Probe | null>;
  onNav: (id: string) => void;
  onClose: () => void;
};

export function Reader(props: Props) {
  const { book, art, slot, layout, closing, still, prev, next } = props;
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  // Entrances are animations; a timer ends them so nothing can stay hidden.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 1300);
    return () => window.clearTimeout(t);
  }, []);
  const [base, setBase] = useState(() => jacketBase());
  const { note, state, retry } = useNote(book.id);

  const shelfPose: Pose = {
    yaw: (layout === "spines" ? 90 : 0) + ((slot?.yaw ?? 0) * 180) / Math.PI,
    pitch: -24,
  };
  const [from] = useState(shelfPose);

  useEffect(() => setMore(false), [book.id]);

  useEffect(() => {
    const resize = () => setBase(jacketBase());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Fall from the shelf copy to the reading position.
  useLayoutEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const el = flightRef.current;
    if (!el || still || !el.animate) return;
    const to = el.getBoundingClientRect();
    const o = props.origin;
    const anim = o
      ? el.animate(
          [
            {
              transform: `translate(${o.left + o.width / 2 - (to.left + to.width / 2)}px, ${o.top + o.height / 2 - (to.top + to.height / 2)}px) scale(${clamp(o.height / to.height, 0.05, 2)})`,
              offset: 0,
              easing: "cubic-bezier(.5,0,.75,.4)",
            },
            {
              transform: "translate(0px, 10px) scale(1.07)",
              offset: 0.66,
              easing: "cubic-bezier(.2,.7,.2,1)",
            },
            { transform: "translate(0px, 0px) scale(1)", offset: 1 },
          ],
          { duration: 980 },
        )
      : // No shelf copy to fly from (a direct link): rise into place, never hidden.
        el.animate(
          [
            { transform: "translate(0px, 70px) scale(.86)" },
            { transform: "translate(0px, 0px) scale(1)" },
          ],
          { duration: 700, easing: "cubic-bezier(.16,1,.3,1)" },
        );
    const done = window.setTimeout(() => anim.finish(), 1150);
    return () => {
      window.clearTimeout(done);
      anim.cancel();
    };
    // Runs once: the reader mounts when a book is picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // And fall back into orbit.
  const [leaving, setLeaving] = useState<Pose | null>(null);
  useEffect(() => {
    if (!closing) return;
    setLeaving(shelfPose);
    const el = flightRef.current;
    if (!el || still || !el.animate) return;
    const at = el.getBoundingClientRect();
    const r = props.returnRect();
    const visible =
      r && r.bottom > 0 && r.top < window.innerHeight && r.width > 2;
    el.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
        visible
          ? {
              transform: `translate(${r.left + r.width / 2 - (at.left + at.width / 2)}px, ${r.top + r.height / 2 - (at.top + at.height / 2)}px) scale(${clamp(r.height / at.height, 0.05, 2)})`,
              opacity: 1,
            }
          : { transform: "translate(0px, 30vh) scale(.2)", opacity: 0 },
      ],
      { duration: 540, easing: "cubic-bezier(.55,0,.8,.35)", fill: "forwards" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  // Tell the fabric where the book is, so the stars lens around it.
  useEffect(() => {
    let raf = 0;
    const probe = props.probe;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = flightRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      probe.current = {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        r: Math.hypot(r.width, r.height) / 2 + 26,
      };
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      probe.current = null;
    };
  }, [props.probe]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
      return;
    }
    const inBook = (e.target as HTMLElement).closest?.(".gj-book");
    if (!inBook && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      const go = e.key === "ArrowLeft" ? prev : next;
      if (go) {
        e.preventDefault();
        props.onNav(go.id);
      }
      return;
    }
    if (e.key !== "Tab") return;
    const root = rootRef.current;
    if (!root) return;
    const stops = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex="0"]',
      ),
    );
    if (!stops.length) return;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const mass = art.pages ? `Mass ${art.pages} pp` : "Mass unmeasured";

  return (
    <div
      ref={rootRef}
      className={
        "gr" + (closing ? " is-closing" : "") + (settled ? " is-settled" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="gr-scroll">
        <button
          type="button"
          className="gr-close"
          onClick={props.onClose}
          aria-label="Close and return the book to its shelf"
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Return to shelf</span>
          <kbd>Esc</kbd>
        </button>

        <div className="gr-top">
          <div className="gr-flight" ref={flightRef}>
            <Jacket
              id={book.id}
              art={art}
              author={book.author}
              base={base}
              from={from}
              leaving={leaving}
              still={still}
            />
          </div>
          <p className="gr-hint">Drag to turn. Click to open the cover.</p>
        </div>

        <article className="gr-sheet" key={book.id}>
          <p className="gr-pos">
            {slot
              ? `Shelf ${pad(slot.row + 1)} · Slot ${pad(slot.col + 1)} · `
              : ""}
            {mass}
          </p>
          <h2 id={titleId} className="gr-title">
            {art.title}
          </h2>

          <div className="gr-row">
            <p className="gr-key">Author</p>
            <p className="gr-author">{book.author}</p>
          </div>

          <div className="gr-row">
            <p className="gr-key">Brief</p>
            <div className="gr-val" aria-live="polite">
              {state === "loading" && (
                <p className="gr-wait">Reading the synopsis</p>
              )}
              {state === "error" && (
                <p className="gr-wait">
                  The synopsis did not load.{" "}
                  <button type="button" className="gr-link" onClick={retry}>
                    Try again
                  </button>
                </p>
              )}
              {state === "ok" && note === null && (
                <p className="gr-wait">No synopsis yet.</p>
              )}
              {state === "ok" && note && (
                <p className="gr-brief">{note.brief}</p>
              )}
            </div>
          </div>

          {state === "ok" && note && (
            <>
              {more && (
                <div className="gr-more">
                  <div className="gr-row">
                    <p className="gr-key">In full</p>
                    <div className="gr-val gr-long">
                      {note.synopsis.split(/\n{2,}/).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </div>
                  {note.author && (
                    <div className="gr-row">
                      <p className="gr-key">Author background</p>
                      <div className="gr-val gr-long">
                        <p>{note.author}</p>
                      </div>
                    </div>
                  )}
                  {note.source && (
                    <div className="gr-row">
                      <p className="gr-key">Source</p>
                      <p className="gr-val">
                        <a
                          className="gr-link"
                          href={note.source}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="gr-row">
                <span className="gr-key" aria-hidden="true" />
                <p className="gr-val">
                  <button
                    type="button"
                    className="gr-toggle"
                    aria-expanded={more}
                    onClick={() => setMore((m) => !m)}
                  >
                    {more ? "Show less" : "Show more"}
                  </button>
                </p>
              </div>
            </>
          )}

          <div className="gr-row">
            <p className="gr-key">Category</p>
            <p className="gr-val gr-fact">{book.focus}</p>
          </div>
          {art.pages && art.edition && (
            <div className="gr-row">
              <p className="gr-key">Edition</p>
              <p className="gr-val gr-fact">
                <a
                  className="gr-link"
                  href={art.edition}
                  target="_blank"
                  rel="noreferrer"
                >
                  {art.pages} pages · {art.editionLabel}
                </a>
              </p>
            </div>
          )}
          {art.custom && (
            <div className="gr-row">
              <span className="gr-key" aria-hidden="true" />
              <p className="gr-val gr-small">Custom library jacket</p>
            </div>
          )}

          <nav className="gr-nav" aria-label="Neighbouring books">
            <button
              type="button"
              disabled={!prev}
              onClick={() => prev && props.onNav(prev.id)}
            >
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>
                <small>Previous</small>
                <b>{prev ? prev.title : "Start of the shelf"}</b>
              </span>
            </button>
            <button
              type="button"
              disabled={!next}
              onClick={() => next && props.onNav(next.id)}
            >
              <span>
                <small>Next</small>
                <b>{next ? next.title : "End of the shelf"}</b>
              </span>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </nav>
        </article>
      </div>
    </div>
  );
}

function jacketBase() {
  return Math.round(
    clamp(
      Math.min(window.innerHeight * 0.42, window.innerWidth * 0.82),
      220,
      420,
    ),
  );
}
