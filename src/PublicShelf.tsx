import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, BookOpen, Search, KeyRound } from "lucide-react";
import { Brand, Cover, BookCard, Dialog, type ShelfBook } from "./components";
import { focuses } from "./model";

export function PublicShelf() {
  const [books, setBooks] = useState<ShelfBook[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0),
    [limit, setLimit] = useState(36);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "",
    focus = params.get("category") || "",
    selectedId = params.get("pick");
  const selected = books.find((b) => b.id === selectedId);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setLoading(true);
    fetch("/api/shelf", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const result = await r.json();
        setBooks(result.books);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  function filter(k: string, v: string) {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
    setLimit(36);
  }
  function open(id: string) {
    const next = new URLSearchParams(params);
    next.set("pick", id);
    setParams(next);
  }
  const matches = books.filter(
    (b) =>
      (!focus || b.focus === focus) &&
      (b.title + " " + b.author)
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const featured = books.filter((b) => b.cover).slice(0, 4);
  return (
    <>
      <header>
        <div className="mast visitor-mast">
          <Link to="/" className="brand-link">
            <Brand />
          </Link>
          <Link className="owner-link" to="/admin">
            <KeyRound size={14} />
            Owner sign-in
          </Link>
        </div>
      </header>
      <main className="visitor">
        <section className="shelf-hero">
          <div>
            <span className="kicker">
              The personal library of Yuvraj Kashyap
            </span>
            <h1>
              On my <i>bookshelf.</i>
            </h1>
            <a href="#browse">
              Browse the collection <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="display-shelf">
            {featured.map((b) => (
              <button
                key={b.id}
                aria-label={"Pick up " + b.title}
                onClick={() => open(b.id)}
              >
                <Cover book={b} />
              </button>
            ))}
          </div>
        </section>
        <section id="browse">
          <div className="section-head">
            <h2>
              The collection <small>{loading ? "…" : books.length}</small>
            </h2>
            <label className="search visitor-search">
              <Search size={16} />
              <input
                type="search"
                aria-label="Search the collection"
                placeholder="Find a title or author"
                value={query}
                onChange={(e) => filter("q", e.target.value)}
              />
            </label>
          </div>
          <div className="pills categories" aria-label="Filter by category">
            {["", ...focuses].map((f) => (
              <button
                key={f}
                aria-pressed={f === focus}
                onClick={() => filter("category", f)}
              >
                {f || "All books"}
              </button>
            ))}
          </div>
          {loading ? (
            <p role="status">Opening the shelf…</p>
          ) : error ? (
            <p role="alert">
              The shelf couldn’t load.{" "}
              <button onClick={() => setRetry(retry + 1)}>Try again</button>
            </p>
          ) : (
            <>
              <div className="covers visitor-covers">
                {matches.slice(0, limit).map((b) => (
                  <BookCard key={b.id} book={b} open={open} />
                ))}
              </div>
              {!matches.length && <p>No books match this search.</p>}
              {limit < matches.length && (
                <button className="more" onClick={() => setLimit(limit + 48)}>
                  Show more books · {matches.length - limit} remaining
                </button>
              )}
            </>
          )}
        </section>
      </main>
      {selected && (
        <Dialog title="From the shelf" onClose={() => filter("pick", "")}>
          <div className="visitor-detail">
            <Cover book={selected} />
            <div>
              <span className="kicker">{selected.focus}</span>
              <h2>{selected.title}</h2>
              <p>{selected.author}</p>
            </div>
          </div>
          <button
            onClick={() => {
              const next = new URLSearchParams();
              next.set("category", selected.focus);
              setParams(next);
              setLimit(36);
              document.getElementById("browse")?.scrollIntoView();
            }}
          >
            <BookOpen size={16} />
            Browse this category
          </button>
        </Dialog>
      )}
    </>
  );
}
