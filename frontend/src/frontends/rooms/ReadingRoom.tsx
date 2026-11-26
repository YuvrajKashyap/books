// The reading room: what is open on the desk, and what comes next.
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { focuses, nextPick, queue, type Book } from "../../shared/owner";
import { bookArt } from "../../shared/catalogue";
import { useTitle } from "../../shared/site";
import { Orbit, ProgressDial } from "./Instruments";
import { Face, Spine, Volume } from "./Volume";
import { cx, shortFocus, useMedia, useRooms } from "./util";

export function ReadingRoom() {
  useTitle("Reading room");
  const { library, open, reduced } = useRooms();
  const phone = useMedia("(max-width: 760px)");
  const books = library.books;
  const reading = useMemo(
    () => books.filter((b) => b.status === "Reading"),
    [books],
  );
  const counts = useMemo(
    () => ({
      reading: reading.length,
      waiting: books.filter((b) => b.status === "To Read").length,
      done: books.filter((b) => b.status === "Completed").length,
    }),
    [books, reading],
  );
  const [index, setIndex] = useState(0);
  const at = Math.min(index, Math.max(0, reading.length - 1));
  const current: Book | undefined = reading[at];

  return (
    <div className="room">
      <section className="desk" aria-labelledby="desk-title">
        <div className="desk-light" aria-hidden="true" />
        {current ? (
          <Desk
            key={current.id}
            book={current}
            phone={phone}
            reduced={reduced}
            first={index === 0}
            onContinue={() => open(current.id)}
            pager={
              reading.length > 1 ? (
                <div
                  className="pager"
                  role="group"
                  aria-label="Books being read"
                >
                  <button
                    type="button"
                    className="btn btn-round"
                    aria-label="Previous book being read"
                    onClick={() =>
                      setIndex((at - 1 + reading.length) % reading.length)
                    }
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <span aria-live="polite">
                    <b>{String(at + 1).padStart(2, "0")}</b> /{" "}
                    {String(reading.length).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    className="btn btn-round"
                    aria-label="Next book being read"
                    onClick={() => setIndex((at + 1) % reading.length)}
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </div>
              ) : null
            }
          />
        ) : (
          <div className="desk-empty">
            <div className="desk-ring" aria-hidden="true">
              <Rings />
            </div>
            <p className="eyebrow">On the desk</p>
            <h1 id="desk-title" className="display">
              The desk is <em>clear.</em>
            </h1>
            <p className="lede">
              Nothing is marked as being read. Take the next pick below, or set
              any book to Reading and it will be waiting here under the lamp.
            </p>
            <div className="row">
              <Link to="/queues" className="btn btn-brass">
                Open the queues
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <button type="button" className="btn" onClick={() => open("new")}>
                <Plus size={16} aria-hidden="true" />
                Add a book
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="tally" aria-label="The library in numbers">
        <Tally
          n={counts.reading}
          label="Reading"
          to="/collection?status=Reading"
        />
        <Tally
          n={counts.waiting}
          label="To read"
          to="/collection?status=To+Read"
        />
        <Tally n={counts.done} label="Completed" to="/history" />
        <Tally n={books.length} label="In the library" to="/collection" />
      </section>

      <NextUp />

      <section className="strip" aria-labelledby="strip-title">
        <header className="section-head">
          <div>
            <p className="eyebrow">The shelf</p>
            <h2 id="strip-title" className="title">
              First along the wall
            </h2>
          </div>
          <Link to="/collection" className="btn">
            All {books.length} books
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </header>
        {books.length ? (
          <div
            className="strip-run"
            style={{ "--row": (phone ? 168 : 206) + "px" } as CSSProperties}
          >
            <div className="shelf shelf-spines">
              {books.slice(0, phone ? 40 : 90).map((b) => (
                <span className="slot" key={b.id}>
                  <Spine book={b} size={phone ? 128 : 162} onOpen={open} />
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty">
            The shelves are bare. Add the first book and it will stand here.
          </p>
        )}
      </section>
    </div>
  );
}

function Tally({ n, label, to }: { n: number; label: string; to: string }) {
  return (
    <Link to={to} className="tally-cell">
      <b>{String(n).padStart(2, "0")}</b>
      <span>{label}</span>
      <i aria-hidden="true" />
    </Link>
  );
}

function Rings() {
  return (
    <svg viewBox="0 0 400 400" aria-hidden="true">
      <circle cx="200" cy="200" r="196" className="ring-a" />
      <circle
        cx="200"
        cy="200"
        r="170"
        className="ring-ticks"
        pathLength={360}
      />
      <circle cx="200" cy="200" r="150" className="ring-b" />
      <ellipse cx="200" cy="200" rx="196" ry="70" className="ring-c" />
      <ellipse cx="200" cy="200" rx="70" ry="196" className="ring-c" />
    </svg>
  );
}

function Desk({
  book,
  phone,
  reduced,
  first,
  onContinue,
  pager,
}: {
  book: Book;
  phone: boolean;
  reduced: boolean;
  first: boolean;
  onContinue: () => void;
  pager: ReactNode;
}) {
  const art = bookArt(book);
  return (
    <div className="desk-grid">
      <div className="desk-stage">
        <div className="desk-ring" aria-hidden="true">
          <Rings />
        </div>
        <Volume
          book={book}
          height={phone ? 300 : 430}
          enter={first}
          reduced={reduced}
        />
        <p className="hint" aria-hidden="true">
          drag to turn · tap to open
        </p>
      </div>
      <div className="desk-words">
        <p className="eyebrow">
          On the desk
          <span className="pill">{shortFocus(book.focus)}</span>
        </p>
        <h1
          id="desk-title"
          className={cx(
            "display",
            art.title.length > 64
              ? "display-3"
              : art.title.length > 34 && "display-2",
          )}
        >
          {art.title}
        </h1>
        {book.author && <p className="byline">{book.author}</p>}
        <div className="desk-read">
          <ProgressDial value={book.progress} reduced={reduced} />
          <dl className="facts">
            <div>
              <dt>Progress</dt>
              <dd>
                {book.progress === null
                  ? "Progress not recorded"
                  : book.progress + " of 100"}
              </dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{book.format || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{book.focus}</dd>
            </div>
          </dl>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn-brass btn-big"
            onClick={onContinue}
          >
            Continue
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          {pager}
        </div>
      </div>
    </div>
  );
}

// The rotation instrument and the book it points at. Looking at another
// stop is local to this page; nothing is saved from here.
function NextUp() {
  const { library, open } = useRooms();
  const books = library.books;
  const rotation = library.rotation;
  const heads = useMemo(
    () => focuses.slice(0, 3).map((f) => queue(books, f)),
    [books],
  );
  const pick = nextPick(books, rotation);
  // The stop the real pick comes from (the next category may be empty).
  const pickStop = pick ? focuses.indexOf(pick.focus) : rotation;
  const [looking, setLooking] = useState(pickStop);
  useEffect(() => setLooking(pickStop), [pickStop, pick?.id]);
  const shown = heads[looking]?.[0];
  const isPick = Boolean(shown && pick && shown.id === pick.id);

  return (
    <section className="next" aria-labelledby="next-title">
      <header className="section-head">
        <div>
          <p className="eyebrow">Next in rotation</p>
          <h2 id="next-title" className="title">
            Identity, then Wealth, then Behavior
          </h2>
        </div>
        <Link to="/queues" className="btn">
          Arrange the queues
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <div className="next-grid">
        <div className="next-orbit">
          <Orbit
            next={rotation}
            selected={looking}
            onSelect={setLooking}
            counts={heads.map((h) => h.length)}
            verb="Look at"
          />
          <p className="note">
            The lit stop is next. Pick another stop to look at its queue.
            Looking changes nothing.
          </p>
        </div>
        <div
          className={cx("next-card", isPick && "is-pick")}
          key={shown?.id ?? "none-" + looking}
        >
          {shown ? (
            <>
              <button
                type="button"
                className="next-jacket"
                onClick={() => open(shown.id)}
                aria-label={"Open " + bookArt(shown).title}
              >
                <Face book={shown} size={220} />
              </button>
              <div className="next-words">
                <p className="eyebrow">
                  {isPick
                    ? "The next pick"
                    : "Head of " + shortFocus(focuses[looking])}
                </p>
                <h3 className="title">{bookArt(shown).title}</h3>
                {shown.author && <p className="byline">{shown.author}</p>}
                <p className="note">
                  {isPick && looking !== rotation
                    ? shortFocus(focuses[rotation]) +
                      " is next but its queue is empty, so the pick falls through to " +
                      shortFocus(focuses[looking]) +
                      "."
                    : isPick
                      ? "First in the " +
                        shortFocus(focuses[looking]) +
                        " queue, " +
                        heads[looking].length +
                        " waiting."
                      : "An alternative. It would come up when the rotation reaches " +
                        shortFocus(focuses[looking]) +
                        "."}
                </p>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-brass"
                    onClick={() => open(shown.id)}
                  >
                    Open this book
                  </button>
                  {!isPick && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setLooking(pickStop)}
                    >
                      Back to the pick
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="next-words">
              <p className="eyebrow">{shortFocus(focuses[looking])}</p>
              <h3 className="title">This queue is empty.</h3>
              <p className="note">
                {pick
                  ? "No book is waiting under " + focuses[looking] + "."
                  : "No book is waiting in any of the three rotating categories."}
              </p>
              {pick && looking !== pickStop && (
                <div className="row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setLooking(pickStop)}
                  >
                    Back to the pick
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
