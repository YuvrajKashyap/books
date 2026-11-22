import type { ShelfBook } from "../components";
import { BookPortrait } from "./BookPortrait";
import { BookSynopsis } from "./BookSynopsis";
import { PrintEdition } from "./PrintEdition";
import { jacketFor } from "./artwork";

export function BookEntry({
  book,
  expandedBooks,
  owner = false,
}: {
  book: ShelfBook;
  expandedBooks?: Set<string>;
  owner?: boolean;
}) {
  return (
    <div className="inspection-layout">
      <BookPortrait book={book} />
      <p className="inspection-byline">{book.author}</p>
      <BookSynopsis id={book.id} expandedBooks={expandedBooks} owner={owner} />
      <footer className="inspection-imprint">
        <small>{book.focus}</small>
        <PrintEdition book={book} />
        {jacketFor(book)?.custom && <small>Custom library jacket</small>}
      </footer>
    </div>
  );
}
