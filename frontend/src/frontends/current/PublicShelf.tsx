import { PocketShelf } from "./shelf/PocketShelf";
import { ScienceStudy } from "./shelf/ScienceStudy";
import { BookInspection } from "./shelf/BookInspection";
import { readNote, warmNote } from "../../shared/bookNote";
import { useShelfCamera } from "./shelf/useShelfCamera";
import { Lamplight } from "./shelf/Lamplight";
import { liftBook, reshelveBook } from "./shelf/bookFlight";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Search,
  X,
  LibraryBig,
  GalleryVerticalEnd,
  ListFilter,
  Check,
} from "lucide-react";
import { FocusIcon, type ShelfBook } from "./components";
import { ShelfPick } from "./shelf/ShelfPick";
import { focuses } from "../../../../shared/categories";
import { bindingDepth, displayTitle } from "../../shared/artwork";
import {
  packBays,
  searchShelf,
  sortShelf,
  usePhone,
  useShelfBooks,
  useShelfKeys,
} from "./shelf/catalogue";

type RowProps = {
  books: ShelfBook[];
  index: number;
  covers: boolean;
  turned: string | null;
  turn: (id: string | null) => void;
  open: (id: string) => void;
};
const BookcaseRow = memo(function BookcaseRow({
  books,
  index,
  covers,
  turned,
  turn,
  open,
}: RowProps) {
  return (
    <div
      className="bay walnut-bay"
      style={{ "--grain-y": -index * 29 + "px" } as CSSProperties}
    >
      <div className="bay-floor" />
      <div className={"gallery-volumes " + (covers ? "face-out" : "spine-out")}>
        {books.map((b, position) => {
          const revealed = !covers && b.id === turned;
          const title = displayTitle(b.title);
          return (
            <div
              className={"volume-slot" + (revealed ? " is-turned" : "")}
              key={b.id}
              data-book={b.id}
              style={
                {
                  "--slot": bindingDepth(b) + "px",
                  "--n": position,
                } as CSSProperties
              }
            >
              <ShelfPick
                book={b}
                faceOut={covers || revealed}
                exposedEnd={position === books.length - 1}
                pick={() => {
                  if (covers || revealed) open(b.id);
                  else {
                    warmNote(b.id);
                    turn(b.id);
                  }
                }}
                reshelve={() => turn(null)}
              />
              {revealed && (
                <button
                  className="volume-return"
                  aria-label={"Reshelve " + title}
                  onClick={() => turn(null)}
                >
                  Reshelve
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="shelf-lip">
        <span className="brass-plate">
          SHELF {String(index + 1).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
});
export function PublicShelf() {
  const navigate = useNavigate();
  const { books, state, reload } = useShelfBooks();
  const [rows, setRows] = useState(4),
    [width, setWidth] = useState(() => window.innerWidth),
    [turned, setTurned] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const sentinel = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null);
  const query = params.get("q") || "",
    focus = params.get("category") || "",
    id = params.get("pick"),
    selected = books.find((b) => b.id === id);
  const phone = usePhone();
  const cabinet = useRef<HTMLElement>(null);
  useShelfCamera(cabinet, !phone);
  useEffect(() => {
    const el = cabinet.current;
    if (!el || phone) return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = entry.contentRect.width;
      if (measured > 0) setWidth(measured);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [phone]);
  const covers = params.get("layout") === "covers";
  const sort = params.get("sort") || "shelf";

  useShelfKeys(Boolean(id), search, () => navigate("/admin"));
  const searchResults = useMemo(
    () => searchShelf(books, query),
    [books, query],
  );
  const counts = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const book of searchResults)
      byCategory.set(book.focus, (byCategory.get(book.focus) ?? 0) + 1);
    return byCategory;
  }, [searchResults]);
  const matches = useMemo(
    () =>
      sortShelf(
        searchResults.filter((b) => !focus || b.focus === focus),
        sort,
      ),
    [searchResults, focus, sort],
  );
  const bays = useMemo(
    () => (phone ? [] : packBays(matches, width, covers)),
    [phone, matches, width, covers],
  );
  const visibleBays = bays.slice(0, rows);
  const shown = visibleBays.reduce((sum, bay) => sum + bay.length, 0);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown >= matches.length) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setRows((n) => n + 4);
      },
      { rootMargin: "500px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, matches.length, phone]);
  const param = useCallback(
    (k: string, v: string) => {
      const p = new URLSearchParams(window.location.search);
      if (v) p.set(k, v);
      else p.delete(k);
      setParams(p, { replace: true, preventScrollReset: true });
      if (k !== "pick") {
        setRows(4);
        setTurned(null);
      }
    },
    [setParams],
  );
  const openBook = useCallback(
    (id: string) => {
      void readNote(id).catch(() => {});
      const search = new URLSearchParams(window.location.search);
      search.set("pick", id);
      liftBook(id, () =>
        navigate(
          { search: search.toString() },
          { state: { fromBookshelf: true }, preventScrollReset: true },
        ),
      );
    },
    [navigate],
  );
  function selectBook(id: string) {
    const search = new URLSearchParams(params);
    search.set("pick", id);
    setParams(search, {
      replace: true,
      state: location.state,
      preventScrollReset: true,
    });
  }
  function closeBook() {
    const leave = () => {
      if (location.state?.fromBookshelf) navigate(-1);
      else param("pick", "");
    };
    if (id) reshelveBook(id, leave);
    else leave();
  }
  const current = matches.findIndex((b) => b.id === id);
  const controls = (
    <div className="shelf-layout-controls">
      <div className="segmented" aria-label="Shelf layout">
        <button aria-pressed={!covers} onClick={() => param("layout", "")}>
          <LibraryBig size={15} />
          Spines
        </button>
        <button aria-pressed={covers} onClick={() => param("layout", "covers")}>
          <GalleryVerticalEnd size={15} />
          Covers
        </button>
      </div>
      <div className="public-selects">
        {!phone && (
          <label className="category-picker">
            <select
              aria-label="Category"
              value={focus}
              onChange={(e) => param("category", e.target.value)}
            >
              <option value="">All categories</option>
              {focuses.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        )}
        <label className="category-picker">
          <span className="phone-label">Sort by</span>
          <select
            aria-label="Sort books"
            value={sort}
            onChange={(e) =>
              param("sort", e.target.value === "shelf" ? "" : e.target.value)
            }
          >
            <option value="shelf">Shelf order</option>
            <option value="title">Title A–Z</option>
            <option value="author">Author A–Z</option>
            <option value="short">Shortest first</option>
            <option value="long">Longest first</option>
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
    </div>
  );
  const subjectIndex = (
    <section
      className="subject-index"
      id="subject-index"
      aria-labelledby="index-title"
    >
      <div className="index-heading">
        <h2 id="index-title" tabIndex={-1}>
          Subject index
        </h2>
        <button aria-pressed={!focus} onClick={() => param("category", "")}>
          All subjects <span>{searchResults.length}</span>
        </button>
      </div>
      <div className="index-entries">
        {focuses.map((f) => (
          <button
            key={f}
            aria-pressed={focus === f}
            onClick={() => param("category", focus === f ? "" : f)}
          >
            <FocusIcon focus={f} />
            <span>{f}</span>
            <small>{counts.get(f) ?? 0}</small>
            {focus === f && <Check size={12} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <div className="reading-gallery">
      <header className="library-heading public-heading">
        <div className="library-heading-inner">
          <div className="catalogue-identity">
            <Link
              to="/"
              className="bookplate-name"
              aria-label="Yuvraj Kashyap’s bookshelf"
            >
              Yuvraj Kashyap
            </Link>
            <div className="catalogue-title">
              <h1>
                <i>The</i> Bookshelf
              </h1>
              {state === "ok" && (
                <span className="volume-count">{books.length} volumes</span>
              )}
            </div>
          </div>
          <ScienceStudy />
        </div>
      </header>
      <main className="gallery-main">
        <div className="catalog-controls">
          <div className="search-station" role="search">
            <label className="catalog-search">
              <Search size={18} />
              <input
                ref={search}
                aria-label="Search books"
                placeholder="Find a title or author"
                value={query}
                onChange={(e) => param("q", e.target.value)}
              />
            </label>
            {query && (
              <button
                className="clear-query"
                aria-label="Clear search"
                onClick={() => {
                  param("q", "");
                  search.current?.focus();
                }}
              >
                <X size={15} />
              </button>
            )}
            {query || focus ? (
              <output aria-live="polite">
                {matches.length} {matches.length === 1 ? "match" : "matches"}
              </output>
            ) : (
              <kbd>/</kbd>
            )}
            {phone && (
              <button
                className="jump-index"
                aria-label="Browse categories"
                onClick={() => document.getElementById("index-title")?.focus()}
              >
                <ListFilter size={18} />
              </button>
            )}
          </div>
          {!phone && controls}
        </div>
        <section
          ref={cabinet}
          className={phone ? "pocket-section" : "cabinet"}
          id={phone ? undefined : "bookcase"}
          aria-label="Wooden bookshelf"
        >
          {phone ? (
            state === "ok" &&
            matches.length > 0 && (
              <PocketShelf
                key={JSON.stringify([query, focus, sort, covers])}
                books={matches}
                covers={covers}
                open={openBook}
              />
            )
          ) : (
            <>
              <div className="cornice" />
              {state === "ok" &&
                visibleBays.map((bay, i) => (
                  <BookcaseRow
                    key={i}
                    index={i}
                    covers={covers}
                    turned={
                      turned && bay.some((b) => b.id === turned) ? turned : null
                    }
                    turn={setTurned}
                    books={bay}
                    open={openBook}
                  />
                ))}
              <div className="plinth" />
              <Lamplight ready={state === "ok"} />
            </>
          )}
          {state !== "ok" || !matches.length ? (
            <div className="case-message">
              {state === "loading" ? (
                "Opening the shelves…"
              ) : state === "error" ? (
                <button onClick={reload}>Retry loading the shelves</button>
              ) : (
                "No matching titles."
              )}
            </div>
          ) : null}
        </section>
        {phone && controls}
        {phone && subjectIndex}
        {phone && (
          <footer className="owner-footnote">
            Are you Yuvraj?{" "}
            <Link to="/admin">
              Sign in <ArrowRight size={12} />
            </Link>
          </footer>
        )}
        {!phone && (
          <div ref={sentinel} className="catalog-end">
            {state === "ok" && (
              <>
                <span>
                  {shown} of {matches.length} titles
                </span>
                {shown < matches.length ? (
                  <button onClick={() => setRows((n) => n + 4)}>
                    Load next shelves
                  </button>
                ) : (
                  <a href="#bookcase">Back to the first shelf ↑</a>
                )}
              </>
            )}
          </div>
        )}
        {!phone && state === "ok" && subjectIndex}
      </main>
      {selected && (
        <BookInspection
          book={selected}
          books={matches}
          index={current}
          select={selectBook}
          close={closeBook}
        />
      )}
    </div>
  );
}
