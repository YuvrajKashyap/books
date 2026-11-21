import { startTransition, useEffect, useOptimistic, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import { Dialog, type ShelfBook } from "../components";
import { Hardcover } from "./Hardcover";
import { BookSynopsis } from "./BookSynopsis";
import { PrintEdition } from "./PrintEdition";
import { displayTitle, jacketFor } from "./artwork";
import { canWarmReader, readNote, warmNote } from "./bookNote";

function BookPortrait({ book }: { book: ShelfBook }) {
  const [angle, setAngle] = useState(-12);
  const [opened, setOpened] = useState(false);
  return <div className="inspection-portrait">
    <div className="inspection-stage">
      <div className="inspection-volume" style={{ "--turn": angle + "deg" } as CSSProperties}>
        <Hardcover book={book} opened={opened} priority/>
      </div>
    </div>
    <details className="portrait-tools">
      <summary>Inspect cover <ChevronDown size={13} aria-hidden="true"/></summary>
      <label>Rotate<input type="range" aria-label="Rotate book" min="-100" max="100" value={angle} onChange={e => setAngle(Number(e.target.value))}/></label>
      <button onClick={() => { setAngle(-7); setOpened(!opened); }}><BookOpen size={14}/>{opened ? "Close cover" : "Open cover"}</button>
    </details>
  </div>;
}

type Props = { book: ShelfBook; books: ShelfBook[]; index: number; select: (id: string) => void; close: () => void };
export function BookInspection({ book: linkedBook, books, index: linkedIndex, select, close }: Props) {
  const [book, showBook] = useOptimistic(linkedBook);
  const [expandedBooks] = useState(() => new Set<string>());
  const direction = useRef<1 | -1>(1);
  const index = book === linkedBook ? linkedIndex : books.indexOf(book);
  const previous = index > 0 ? books[index - 1] : undefined;
  const next = index >= 0 ? books[index + 1] : undefined;
  function browse(target: ShelfBook) {
    direction.current = target === previous ? -1 : 1;
    // Commit the reader while handling the button or arrow key. The router
    // replaces the shareable URL in the same transition.
    flushSync(() => startTransition(() => {
      showBook(target);
      select(target.id);
    }));
  }
  const preparedJacket = useRef<HTMLImageElement | null>(null);
  function prepareJacket(target: ShelfBook | undefined) {
    const file = target && jacketFor(target)?.file;
    if (!file || !canWarmReader() || preparedJacket.current?.getAttribute("src") === file) return;
    const image = new Image();
    image.fetchPriority = "low";
    image.src = file;
    preparedJacket.current = image;
    void image.decode().catch(() => {});
  }
  useEffect(() => {
    let active = true;
    readNote(book.id).then(() => {
      if (!active) return;
      if (next) warmNote(next.id);
      if (previous) warmNote(previous.id);
    }).catch(() => {});
    return () => { active = false; };
  }, [book.id, next, previous]);
  function turnPage(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]"))) return;
    const target = event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : undefined;
    if (target) { event.preventDefault(); browse(target); }
  }
  return <Dialog className="book-dialog" title={displayTitle(book.title)} onClose={close} onKeyDown={turnPage}>
    <article key={book.id} className="book-inspection" aria-label={displayTitle(book.title)}
      onLoad={event => { if (event.target instanceof HTMLImageElement) prepareJacket(direction.current > 0 ? next : previous); }}>
      <div className="inspection-layout">
        <BookPortrait book={book}/>
        <p className="inspection-byline">{book.author}</p>
        <BookSynopsis id={book.id} expandedBooks={expandedBooks}/>
        <div className="inspection-imprint"><small>{book.focus}</small><PrintEdition book={book}/>{jacketFor(book)?.custom && <small>Custom library jacket</small>}</div>
      </div>
    </article>
    <nav className="inspect-nav" aria-label="Browse books">
      <button disabled={!previous} title={previous && displayTitle(previous.title)}
        onFocus={() => prepareJacket(previous)} onPointerEnter={e => { if (e.pointerType === "mouse") prepareJacket(previous); }}
        onClick={() => previous && browse(previous)}><ArrowLeft size={15}/>Previous</button>
      {index >= 0 && <span className="inspection-position" aria-live="polite" aria-atomic="true"><span className="sr-only">{displayTitle(book.title)}, </span>{index + 1} of {books.length}</span>}
      <button disabled={!next} title={next && displayTitle(next.title)}
        onFocus={() => prepareJacket(next)} onPointerEnter={e => { if (e.pointerType === "mouse") prepareJacket(next); }}
        onClick={() => next && browse(next)}>Next<ArrowRight size={15}/></button>
    </nav>
  </Dialog>;
}
