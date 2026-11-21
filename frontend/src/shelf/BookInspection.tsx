import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import { Dialog, type ShelfBook } from "../components";
import { Hardcover } from "./Hardcover";
import { BookSynopsis } from "./BookSynopsis";
import { PrintEdition } from "./PrintEdition";
import { displayTitle, jacketFor } from "./artwork";

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
export function BookInspection({ book, books, index, select, close }: Props) {
  const previous = index > 0 ? books[index - 1] : undefined;
  const next = index >= 0 ? books[index + 1] : undefined;
  function turnPage(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable=true]"))) return;
    const target = event.key === "ArrowLeft" ? previous : event.key === "ArrowRight" ? next : undefined;
    if (target) { event.preventDefault(); select(target.id); }
  }
  return <Dialog title={displayTitle(book.title)} onClose={close} onKeyDown={turnPage}>
    <article key={book.id} className="book-inspection" aria-label={displayTitle(book.title)}>
      <div className="inspection-layout">
        <BookPortrait book={book}/>
        <p className="inspection-byline">{book.author}</p>
        <BookSynopsis id={book.id}/>
        <div className="inspection-imprint"><small>{book.focus}</small><PrintEdition book={book}/>{jacketFor(book)?.custom && <small>Custom library jacket</small>}</div>
      </div>
    </article>
    <nav className="inspect-nav" aria-label="Browse books">
      <button disabled={!previous} onClick={() => previous && select(previous.id)}><ArrowLeft size={15}/>Previous</button>
      {index >= 0 && <span className="inspection-position" aria-live="polite" aria-atomic="true"><span className="sr-only">{displayTitle(book.title)}, </span>{index + 1} of {books.length}</span>}
      <button disabled={!next} onClick={() => next && select(next.id)}>Next<ArrowRight size={15}/></button>
    </nav>
  </Dialog>;
}
