import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Book } from "../../../shared/model";
import { bindingDepth, displayTitle } from "./artwork";
import { ShelfPick } from "./ShelfPick";
import { BoundVolume } from "./BoundVolume";
import { useRailDrag } from "./useRailDrag";
import { scrollShelfWheel } from "./wheel";

type BookProps = {
  book: Book;
  selected: boolean;
  // Cover layout: every book faces out and a single press opens it.
  faceOut?: boolean;
  open: (id: string) => void;
  turn: (id: string | null) => void;
  painted?: boolean;
  exposedEnd?: boolean;
  left?: number;
};

export const ShelfSpine = memo(function ShelfSpine({
  book,
  selected,
  faceOut = false,
  open,
  turn,
  painted = true,
  exposedEnd,
  left,
}: BookProps) {
  const title = displayTitle(book.title);
  const depth = bindingDepth(book);
  const style = {
    "--slot": depth + "px",
    "--book-left": left,
    "--book-center":
      left === undefined
        ? undefined
        : left + Math.round((selected || faceOut ? 128 : depth) / 2),
  } as CSSProperties;
  return (
    <div
      className={"volume-slot" + (selected || faceOut ? " is-turned" : "")}
      data-book={book.id}
      style={style}
    >
      <ShelfPick
        book={book}
        faceOut={selected || faceOut}
        exposedEnd={exposedEnd}
        painted={painted || selected}
        pick={() => (selected || faceOut ? open(book.id) : turn(book.id))}
        reshelve={() => turn(null)}
      />
      {selected && !faceOut && (
        <button
          className="volume-return"
          onClick={() => turn(null)}
          aria-label={"Reshelve " + title}
        >
          Reshelve
        </button>
      )}
    </div>
  );
});

type Props = Pick<BookProps, "open" | "turn"> & {
  label: string;
  books: Book[];
  covers: boolean;
  turned: string | null;
};

export function ContinuousShelf({
  label,
  books,
  covers,
  turned,
  open,
  turn,
}: Props) {
  const rack = useRef<HTMLDivElement>(null);
  useRailDrag(rack);
  const [painted, setPainted] = useState<Set<string>>(() => new Set());
  const membership = JSON.stringify(books.map((b) => b.id));

  useLayoutEffect(() => {
    const el = rack.current!;
    // Every book keeps its native focus target and width. Only nearby books
    // need a jacket image and the ten faces of the bound volume.
    const observer = new IntersectionObserver(
      (entries) => {
        setPainted((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.book!;
            if (entry.isIntersecting) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      },
      { root: el, rootMargin: "0px 240px" },
    );
    for (const slot of el.children) observer.observe(slot);
    return () => observer.disconnect();
  }, [membership, covers]);

  useLayoutEffect(() => {
    const el = rack.current!;
    let frame = 0;
    let padding = 0;
    const align = () => {
      frame = 0;
      el.style.setProperty(
        "--rail-eye",
        String(Math.round(el.scrollLeft + el.clientWidth / 2 - padding)),
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(align);
    };
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

  // Matches column-gap on .owner-rack (room.css) and its cover layout
  // (lamplight.css), so each slot's computed eye line is where it is drawn.
  const gap = covers ? 14 : 2;
  let left = 0;
  return (
    <div
      className={"owner-rack continuous-shelf" + (covers ? " face-out" : "")}
      ref={rack}
      role="region"
      aria-label={label + " horizontal bookshelf"}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          e.currentTarget.scrollLeft =
            e.key === "Home" ? 0 : e.currentTarget.scrollWidth;
        }
      }}
      onTransitionEnd={(e) => {
        const slot = e.target;
        if (
          e.propertyName !== "width" ||
          !(slot instanceof HTMLElement) ||
          !slot.classList.contains("is-turned")
        )
          return;
        const el = e.currentTarget;
        const overflow =
          slot.getBoundingClientRect().right -
          el.getBoundingClientRect().left -
          el.clientLeft -
          el.clientWidth;
        if (overflow > 0 && overflow < 140)
          el.scrollBy({ left: Math.ceil(overflow) });
      }}
    >
      {books.map((book, index) => {
        const position = left;
        const selected = turned === book.id;
        left += (selected || covers ? 128 : bindingDepth(book)) + gap;
        return (
          <ShelfSpine
            key={book.id}
            book={book}
            open={open}
            turn={turn}
            selected={selected}
            faceOut={covers}
            left={position}
            exposedEnd={index === books.length - 1}
            painted={painted.has(book.id)}
          />
        );
      })}
    </div>
  );
}
