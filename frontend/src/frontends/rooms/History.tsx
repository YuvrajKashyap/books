// Finished books laid along a worldline: oldest first,
// each year a strip of film. Dates are shown only when they are recorded.
import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { completed, type Book } from "../../shared/owner";
import { bookArt } from "../../shared/catalogue";
import { useTitle } from "../../shared/site";
import { Face } from "./Volume";
import {
  Stars,
  longDate,
  shortDate,
  shortFocus,
  useMedia,
  useRooms,
} from "./util";

type Year = { key: string; year: number | null; books: Book[] };

export function History() {
  useTitle("History");
  const { library, open, reduced } = useRooms();
  const phone = useMedia("(max-width: 760px)");
  const done = useMemo(() => completed(library.books), [library.books]);
  const years = useMemo(() => {
    const map = new Map<string, Year>();
    for (const b of done) {
      const y = b.finished ? b.finished.slice(0, 4) : "Undated";
      if (!map.has(y))
        map.set(y, { key: y, year: b.finished ? Number(y) : null, books: [] });
      map.get(y)!.books.push(b);
    }
    return [...map.values()];
  }, [done]);

  const dated = years.filter((y) => y.year !== null);
  const undated = years.find((y) => y.year === null);
  const span = dated.length
    ? { from: dated[0].year!, to: dated[dated.length - 1].year! }
    : null;
  const scale = span
    ? Array.from({ length: span.to - span.from + 1 }, (_, i) => {
        const year = span.from + i;
        return {
          year,
          n: dated.find((y) => y.year === year)?.books.length ?? 0,
        };
      })
    : [];
  const peak = Math.max(1, ...scale.map((s) => s.n));

  function jump(key: string) {
    document.getElementById("year-" + key)?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }

  if (!done.length)
    return (
      <div className="hist">
        <header className="page-head">
          <div>
            <p className="eyebrow">History</p>
            <h1 className="display display-2">
              The worldline <em>starts here.</em>
            </h1>
          </div>
        </header>
        <div className="empty empty-big">
          <h2 className="title">No finished books yet.</h2>
          <p>
            When a book is marked Completed it takes its place on this line,
            under the year it was finished.
          </p>
          <Link to="/room" className="btn btn-brass">
            Back to the reading room
          </Link>
        </div>
      </div>
    );

  return (
    <div className="hist">
      <header className="page-head">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="display display-2">
            {done.length} finished, <em>along one line.</em>
          </h1>
        </div>
        <p className="count">
          {span && (
            <>
              <b>
                {span.from === span.to ? span.to : span.from + " to " + span.to}
              </b>{" "}
            </>
          )}
          {undated ? undated.books.length + " undated" : "every book dated"}
        </p>
      </header>

      {scale.length > 0 && (
        <nav className="scale" aria-label="Jump to a year">
          <div className="scale-run">
            {scale.map((s) => (
              <button
                key={s.year}
                type="button"
                className="scale-bar"
                disabled={!s.n}
                onClick={() => jump(String(s.year))}
                aria-label={
                  s.year + ", " + s.n + (s.n === 1 ? " book" : " books")
                }
                style={{ "--n": s.n / peak } as CSSProperties}
              >
                <b>{s.n || ""}</b>
                <i aria-hidden="true" />
                <span>
                  {phone && scale.length > 8
                    ? "’" + String(s.year).slice(2)
                    : s.year}
                </span>
              </button>
            ))}
          </div>
          <span className="scale-axis" aria-hidden="true" />
          <p className="note">
            Books finished per year. Press a year to go to it.
          </p>
        </nav>
      )}

      <ol className="line">
        {years.map((y) => (
          <li className="yr" id={"year-" + y.key} key={y.key}>
            <div className="yr-mark">
              <i className="yr-cone" aria-hidden="true" />
              <h2 className={y.year === null ? "is-undated" : undefined}>
                {y.year ?? "Undated"}
              </h2>
              <p>
                {y.books.length} {y.books.length === 1 ? "book" : "books"}
                {y.year === null && <span>No finish date recorded</span>}
              </p>
            </div>
            <ul className="film">
              {y.books.map((b) => (
                <Frame
                  key={b.id}
                  book={b}
                  size={phone ? 150 : 196}
                  onOpen={open}
                />
              ))}
            </ul>
          </li>
        ))}
        <li className="line-end" aria-hidden="true" />
      </ol>
    </div>
  );
}

function Frame({
  book,
  size,
  onOpen,
}: {
  book: Book;
  size: number;
  onOpen: (id: string) => void;
}) {
  const title = bookArt(book).title;
  return (
    <li className="frame">
      <button type="button" onClick={() => onOpen(book.id)}>
        <span className="frame-edge" aria-hidden="true">
          {book.finished ? shortDate(book.finished) : "no date"}
        </span>
        <span className="frame-art">
          <Face book={book} size={size} />
        </span>
        <span className="frame-words">
          <b>{title}</b>
          {book.author && <span>{book.author}</span>}
          <small>
            {shortFocus(book.focus)}
            {book.finished && (
              <>
                {" · "}
                <time dateTime={book.finished}>{longDate(book.finished)}</time>
              </>
            )}
          </small>
          <Stars value={book.rating} />
        </span>
      </button>
    </li>
  );
}
