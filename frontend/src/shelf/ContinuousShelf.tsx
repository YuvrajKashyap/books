import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Book } from "../../../shared/model";
import { bindingDepth, displayTitle } from "./artwork";
import { BoundVolume } from "./BoundVolume";
import { scrollShelfWheel } from "./wheel";

type BookProps = {
  book: Book;
  selected: boolean;
  open: (id: string) => void;
  turn: (id: string | null) => void;
  painted?: boolean;
  left?: number;
};

export const ShelfSpine = memo(function ShelfSpine({ book, selected, open, turn, painted = true, left }: BookProps) {
  const title = displayTitle(book.title);
  const depth = bindingDepth(book);
  const style = { "--slot": depth + "px", "--book-left": left,
    "--book-center": left === undefined ? undefined : left + Math.round((selected ? 128 : depth) / 2) } as CSSProperties;
  return <div className={"volume-slot" + (selected ? " is-turned" : "")} data-book={book.id} style={style}>
    <button className="volume-pick" title={title + " · " + book.author}
      aria-label={(selected ? "Open details for " : "Turn to cover of ") + title + " by " + book.author}
      onClick={() => selected ? open(book.id) : turn(book.id)}
      onKeyDown={e => { if (e.key === "Escape") turn(null); }}>
      {(painted || selected) && <BoundVolume book={book} showJacket={left === undefined || selected}/>}
    </button>
    {selected && <button className="volume-return" onClick={() => turn(null)} aria-label={"Reshelve " + title}>Reshelve</button>}
  </div>;
});

const ShelfCover = memo(function ShelfCover({ book, open, painted }: Pick<BookProps, "book" | "open" | "painted">) {
  return <div className="card-wrap" data-book={book.id}>
    <button className="bookcard" onClick={() => open(book.id)}>
      <span className="cover-model">{painted && <BoundVolume book={book}/>}</span>
      <strong>{displayTitle(book.title)}</strong><small>{book.author || "Author unlisted"}</small>
    </button>
  </div>;
});

type Props = Pick<BookProps, "open" | "turn"> & {
  books: Book[]; covers: boolean; turned: string | null;
};

export function ContinuousShelf({ books, covers, turned, open, turn }: Props) {
  const rack = useRef<HTMLDivElement>(null);
  const [painted, setPainted] = useState<Set<string>>(() => new Set());
  const membership = JSON.stringify(books.map(b => b.id));

  useLayoutEffect(() => {
    const el = rack.current!;
    // Every book keeps its native focus target and width. Only nearby books
    // need a jacket image and the ten faces of the bound volume.
    const observer = new IntersectionObserver(entries => {
      setPainted(previous => {
        const next = new Set(previous);
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.book!;
          if (entry.isIntersecting) next.add(id); else next.delete(id);
        }
        return next;
      });
    }, { root: el, rootMargin: "0px 240px" });
    for (const slot of el.children) observer.observe(slot);
    return () => observer.disconnect();
  }, [membership, covers]);

  useLayoutEffect(() => {
    const el = rack.current!;
    let frame = 0;
    let padding = 0;
    const align = () => {
      frame = 0;
      el.style.setProperty("--rail-eye", String(Math.round(el.scrollLeft + el.clientWidth / 2 - padding)));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(align); };
    const wheel = (event: WheelEvent) => scrollShelfWheel(el, event);
    const measure = () => {
      padding = parseFloat(getComputedStyle(el).paddingLeft);
      schedule();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    el.addEventListener("scroll", schedule, { passive: true });
    el.addEventListener("wheel", wheel, { passive: false });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      el.removeEventListener("scroll", schedule);
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  let left = 0;
  return <div className={(covers ? "covers" : "owner-rack") + " continuous-shelf"} ref={rack}
    role="region" aria-label="To Read horizontal bookshelf" tabIndex={0}
    onKeyDown={e => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        e.currentTarget.scrollLeft = e.key === "Home" ? 0 : e.currentTarget.scrollWidth;
      }
    }}
    onTransitionEnd={e => {
      const slot = e.target;
      if (e.propertyName !== "width" || !(slot instanceof HTMLElement) || !slot.classList.contains("is-turned")) return;
      const el = e.currentTarget;
      const overflow = slot.getBoundingClientRect().right - el.getBoundingClientRect().left - el.clientLeft - el.clientWidth;
      if (overflow > 0 && overflow < 140) el.scrollBy({ left: Math.ceil(overflow) });
    }}>
    {books.map(book => {
      if (covers) return <ShelfCover key={book.id} book={book} open={open} painted={painted.has(book.id)}/>;
      const position = left;
      const selected = turned === book.id;
      left += (selected ? 128 : bindingDepth(book)) + 2;
      return <ShelfSpine key={book.id} book={book} open={open} turn={turn} selected={selected}
        left={position} painted={painted.has(book.id)}/>;
    })}
  </div>;
}
