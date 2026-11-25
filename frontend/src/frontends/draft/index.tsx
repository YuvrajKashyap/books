// The Drawing: an inked survey of the shelf that your light develops into
// colour. This file holds the sheet's furniture (title, title block, plot
// controls, revisions, edge) and the state kept in the address.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { X } from "lucide-react";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./draft.css";
import {
  bookArt,
  focuses,
  sorts,
  useShelf,
  useShelfKeys,
  type Focus,
} from "../../shared/catalogue";
import { site, useTitle } from "../../shared/site";
import {
  isFocus,
  isSort,
  letters,
  sectionsFor,
  type Entry,
  type Mode,
} from "./layout";
import { Glyph, Sheet } from "./Sheet";
import { Reader } from "./Reader";
import { Studies } from "./Studies";

function useMedia(query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

const num = (n: number) => n.toLocaleString("en");

// Text that letters itself in, one cell after another.
function Cell({
  k,
  label,
  children,
  wide,
  extra,
}: {
  k: number;
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  extra?: boolean; // left off the phone's short title block
}) {
  return (
    <div className={"tb-cell" + (wide ? " wide" : "") + (extra ? " tb-x" : "")}>
      <span className="tb-k">{label}</span>
      <span className="tb-v" style={{ "--k": k } as CSSProperties}>
        {children}
      </span>
    </div>
  );
}

export default function Draft() {
  const { books, state, reload } = useShelf();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const compact = useMedia("(max-width: 720px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");

  const q = params.get("q") ?? "";
  const focusParam = params.get("focus");
  const focus: Focus | null = isFocus(focusParam) ? focusParam : null;
  const sortParam = params.get("sort");
  const sort = isSort(sortParam) ? sortParam : "shelf";
  const mode: Mode = params.get("layout") === "covers" ? "covers" : "spines";
  const bookId = params.get("book");

  const root = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);

  const put = useCallback(
    (key: string, value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);

  // Everything the sheet knows.
  const arts = useMemo(
    () => new Map(books.map((b) => [b.id, bookArt(b)])),
    [books],
  );
  const entries = useMemo(
    () =>
      new Map(
        books.map((book, i): [string, Entry] => [
          book.id,
          {
            book,
            art: arts.get(book.id)!,
            no: i + 1,
            cat: Math.max(0, focuses.indexOf(book.focus as Focus)),
            active: true,
          },
        ]),
      ),
    [books, arts],
  );
  const tally = useMemo(() => {
    const cats = focuses.map(() => ({ count: 0, pages: 0, known: 0 }));
    let pages = 0;
    let known = 0;
    for (const e of entries.values()) {
      const c = cats[e.cat];
      c.count++;
      if (e.art.pages) {
        c.pages += e.art.pages;
        c.known++;
        pages += e.art.pages;
        known++;
      }
    }
    return { cats, pages, known };
  }, [entries]);
  const sections = useMemo(
    () => sectionsFor(books, arts, q, focus, sort),
    [books, arts, q, focus, sort],
  );
  const order = useMemo(
    () => sections.flatMap((s) => s.entries.map((e) => e.book.id)),
    [sections],
  );
  const inked = useMemo(
    () =>
      sections.reduce(
        (n, s) => n + s.entries.filter((e) => e.active).length,
        0,
      ),
    [sections],
  );
  const filtered = Boolean(q.trim() || focus);
  const total = books.length;

  // Develop all: the visitor's choice, else on for phones once the sheet has
  // drawn itself, and always on when motion is reduced.
  const [choice, setChoice] = useState<boolean | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (state !== "ok") return;
    const id = window.setTimeout(() => setDrawn(true), 3000);
    return () => window.clearTimeout(id);
  }, [state]);
  const develop = reduced || (choice ?? (compact && drawn));

  // The reader stays mounted while it folds back, after the address changes.
  const [reader, setReader] = useState<{
    id: string;
    closing: boolean;
    key: number;
  } | null>(null);
  useEffect(() => {
    if (bookId && entries.has(bookId))
      setReader((r) =>
        r && !r.closing
          ? { ...r, id: bookId }
          : { id: bookId, closing: false, key: (r?.key ?? 0) + 1 },
      );
    else setReader((r) => (r && !r.closing ? { ...r, closing: true } : r));
  }, [bookId, entries]);
  const openEntry = reader ? entries.get(reader.id) : undefined;
  useTitle(openEntry && !reader?.closing ? openEntry.art.title : undefined);

  const find = (id: string) =>
    root.current?.querySelector<HTMLElement>(
      `[data-book="${CSS.escape(id)}"]`,
    ) ?? null;
  const origin = (id: string) => {
    const rect = find(id)?.getBoundingClientRect();
    if (!rect || rect.bottom < -160 || rect.top > window.innerHeight + 160)
      return null;
    return rect;
  };
  const open = (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("book", id);
        return next;
      },
      { state: { fxDraftOpened: true } },
    );
  const close = () => {
    if ((location.state as { fxDraftOpened?: boolean } | null)?.fxDraftOpened)
      navigate(-1);
    else put("book", null);
  };
  const stepBook = (by: number) => {
    if (!reader || !order.length) return;
    const at = order.indexOf(reader.id);
    const next = order[(at + by + order.length) % order.length];
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("book", next);
        return n;
      },
      { replace: true, state: location.state },
    );
    // Bring its place on the sheet into view, so it has somewhere to return.
    find(next)?.scrollIntoView({ block: "center" });
  };
  const closed = () => {
    const id = reader?.id;
    setReader((r) => (r?.closing ? null : r));
    if (id)
      requestAnimationFrame(() => find(id)?.focus({ preventScroll: true }));
  };

  useShelfKeys({
    paused: Boolean(reader),
    search: () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    },
    enter: () => navigate("/admin"),
  });

  // The margin ruler, the lamp's glow and the light on the name. These are
  // written straight to their elements so nothing else restyles.
  useEffect(() => {
    let cx = -1;
    let cy = -1;
    const ruler = () => {
      const y = window.scrollY;
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const el = rulerRef.current;
      if (el) {
        el.style.setProperty("--sy", (-y % 320) + "px");
        el.style.setProperty("--at", ((y / max) * 100).toFixed(2) + "%");
      }
      if (readRef.current)
        readRef.current.textContent =
          "Y " + String(Math.round(y)).padStart(5, "0");
    };
    const light = (x: number, y: number) => {
      cx = x;
      cy = y;
      if (glowRef.current)
        glowRef.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      const name = nameRef.current;
      if (name) {
        const r = name.getBoundingClientRect();
        if (r.bottom > -300) {
          name.style.setProperty("--hx", x - r.left + "px");
          name.style.setProperty("--hy", y - r.top + "px");
        }
      }
    };
    const move = (e: PointerEvent) => light(e.clientX, e.clientY);
    const touch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) light(t.clientX, t.clientY);
    };
    const scroll = () => {
      ruler();
      if (cx >= 0) light(cx, cy);
    };
    ruler();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("touchmove", touch, { passive: true });
    window.addEventListener("touchstart", touch, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", ruler);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("touchmove", touch);
      window.removeEventListener("touchstart", touch);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", ruler);
    };
  }, []);

  const plot = (name: Focus | null) => {
    put("focus", name);
    root.current
      ?.querySelector(".bar")
      ?.scrollIntoView({
        block: "start",
        behavior: reduced ? "auto" : "smooth",
      });
  };
  const reset = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("q");
        next.delete("focus");
        return next;
      },
      { replace: true },
    );

  const sheetName = mode === "spines" ? "Spine elevation" : "Front elevations";
  const sheetNo = mode === "spines" ? "01" : "02";

  return (
    <div
      ref={root}
      className={
        "fx-draft" +
        (develop ? " dev" : "") +
        (compact ? " compact" : "") +
        (reduced ? " calm" : "")
      }
    >
      <div className="frame" aria-hidden="true">
        <i className="reg tl" />
        <i className="reg tr" />
      </div>
      <div className="glow" ref={glowRef} aria-hidden="true" />
      <div className="ruler" ref={rulerRef} aria-hidden="true">
        <i className="ruler-at" />
        <span ref={readRef}>Y 00000</span>
      </div>

      <header className="hd">
        <div className="hd-strip">
          <span>Personal library</span>
          <span>Survey drawing</span>
          <span>Sheet {sheetNo} of 02</span>
        </div>
        <h1 className="name" ref={nameRef}>
          {site.name}
        </h1>
        <div className="hd-row">
          <div className="notes">
            <p className="lede">
              {state !== "ok"
                ? "A personal library, surveyed in line."
                : compact
                  ? `A personal library. ${total} books, four categories. Touch the sheet and it develops into the shelf.`
                  : `A personal library. ${total} books in four categories, surveyed in line. Bring a light to the sheet and it develops into the shelf itself.`}
            </p>
            {state === "ok" && (
              <ol>
                <li>
                  Your pointer or finger is a light. Move it across the sheet.
                </li>
                <li>Hold still and the pool of light grows.</li>
                <li>Drag the lamp from the corner to fix a light in place.</li>
                <li>Choose a book to take it off the sheet.</li>
              </ol>
            )}
          </div>
          {state === "ok" && (
            <div className="tb" role="group" aria-label="Title block">
              <Cell k={0} label="Sheet" wide extra>
                {sheetNo} · {sheetName}
              </Cell>
              <Cell k={1} label="Volumes">
                {total}
              </Cell>
              <Cell k={2} label="Pages, where known">
                {num(tally.pages)}
                <small>
                  {tally.known} of {total} vols
                </small>
              </Cell>
              <Cell k={3} label="Inked">
                <span aria-live="polite">
                  {inked} of {total}
                </span>
              </Cell>
              <div className="tb-legend tb-x">
                <span className="tb-k">Legend</span>
                <ul>
                  {focuses.map((name, i) => (
                    <li
                      key={name}
                      className={focus === name ? "on" : ""}
                      style={{ "--k": 4 + i } as CSSProperties}
                    >
                      <Glyph cat={i} />
                      <b>{letters[i]}</b>
                      <span>{name}</span>
                      <em>{tally.cats[i].count}</em>
                    </li>
                  ))}
                </ul>
              </div>
              <Cell k={8} label="Scale" wide extra>
                Relative. Spine depth follows page count
              </Cell>
              <Cell k={9} label="Library of" extra>
                {site.owner}
              </Cell>
              <Cell k={10} label="Mark" extra>
                {site.monogram}
              </Cell>
            </div>
          )}
        </div>
      </header>

      {state === "loading" && (
        <main className="await" role="status">
          <svg
            viewBox="0 0 600 150"
            aria-hidden="true"
            preserveAspectRatio="none"
          >
            <path pathLength={1} d="M0 60 H600 M0 70 H600" />
            <path pathLength={1} d="M0 130 H600 M0 140 H600" />
            <path pathLength={1} d="M1 0 V140 M599 0 V140" />
          </svg>
          <p>
            Plotting the shelf
            <i />
          </p>
        </main>
      )}

      {state === "error" && (
        <main className="await failed" role="alert">
          <p className="stamp">Survey not received</p>
          <p>The catalogue did not load, so there is nothing to draw yet.</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </main>
      )}

      {state === "ok" && (
        <>
          <div className="bar">
            <div className="bar-a">
              <label className="find">
                <span className="lbl">Find</span>
                <input
                  ref={searchRef}
                  type="text"
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Title or author"
                  aria-label="Search by title or author"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    put("q", e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && text) {
                      e.preventDefault();
                      setText("");
                      put("q", null);
                    }
                  }}
                />
                {text ? (
                  <button
                    type="button"
                    className="find-x"
                    aria-label="Clear search"
                    onClick={() => {
                      setText("");
                      put("q", null);
                      searchRef.current?.focus();
                    }}
                  >
                    <X size={14} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                ) : (
                  <kbd aria-hidden="true">/</kbd>
                )}
              </label>
              <label className="sort">
                <span className="lbl">Order</span>
                <select
                  value={sort}
                  onChange={(e) =>
                    put(
                      "sort",
                      e.target.value === "shelf" ? null : e.target.value,
                    )
                  }
                >
                  {sorts.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="seg" role="group" aria-label="Sheet">
                <button
                  type="button"
                  aria-pressed={mode === "spines"}
                  onClick={() => put("layout", null)}
                >
                  <b>01</b> Spines
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "covers"}
                  onClick={() => put("layout", "covers")}
                >
                  <b>02</b> Covers
                </button>
              </div>
              <button
                type="button"
                className="dev-sw"
                role="switch"
                aria-label="Develop all"
                aria-checked={develop}
                disabled={reduced}
                onClick={() => setChoice(!develop)}
              >
                <i aria-hidden="true" />
                <span>Develop all</span>
              </button>
            </div>
            <div className="bar-b" role="group" aria-label="Category">
              <button
                type="button"
                aria-pressed={!focus}
                onClick={() => put("focus", null)}
              >
                All <em>{total}</em>
              </button>
              {focuses.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={focus === name}
                  onClick={() => put("focus", focus === name ? null : name)}
                >
                  <Glyph cat={i} />
                  <b>{letters[i]}</b> {name} <em>{tally.cats[i].count}</em>
                </button>
              ))}
            </div>
          </div>

          <main className="wrap">
            <Sheet
              sections={sections}
              mode={mode}
              compact={compact}
              reduced={reduced}
              developAll={develop}
              filtered={filtered}
              paused={Boolean(reader)}
              openId={reader?.id ?? null}
              total={total}
              onOpen={open}
              empty={
                inked === 0 ? (
                  <div className="none" role="status">
                    <p className="stamp">Nothing to ink</p>
                    <p>
                      No book{focus ? " in " + focus : ""} matches
                      {" “" + q.trim() + "”"}. The shelf stays in construction
                      lines below.
                    </p>
                    <div>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setText("");
                          put("q", null);
                          searchRef.current?.focus();
                        }}
                      >
                        Clear the search
                      </button>
                      {focus && (
                        <button type="button" className="btn" onClick={reset}>
                          Show the whole shelf
                        </button>
                      )}
                    </div>
                  </div>
                ) : null
              }
            />
            <Studies still={reduced} />
          </main>

          <section className="rev" aria-labelledby="fx-draft-rev">
            <div className="rev-head">
              <h2 id="fx-draft-rev">Revisions</h2>
              <p>
                The shelf as it stands: four categories, {total} volumes,{" "}
                {num(tally.pages)} pages across the {tally.known} whose length
                is recorded.
              </p>
            </div>
            <table>
              <thead>
                <tr>
                  <th scope="col">Rev.</th>
                  <th scope="col">Category</th>
                  <th scope="col">Volumes</th>
                  <th scope="col">Pages known</th>
                  <th scope="col">
                    <span className="sr">Plot</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {focuses.map((name, i) => (
                  <tr key={name} className={focus === name ? "on" : ""}>
                    <td>{letters[i]}</td>
                    <th scope="row">
                      <Glyph cat={i} /> {name}
                    </th>
                    <td>{tally.cats[i].count}</td>
                    <td>
                      {num(tally.cats[i].pages)}
                      <small>
                        {tally.cats[i].known} of {tally.cats[i].count}
                      </small>
                    </td>
                    <td>
                      <button type="button" onClick={() => plot(name)}>
                        Plot <span className="sr">{name}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <th scope="row">Whole shelf</th>
                  <td>{total}</td>
                  <td>
                    {num(tally.pages)}
                    <small>
                      {tally.known} of {total}
                    </small>
                  </td>
                  <td>
                    <button type="button" onClick={() => plot(null)}>
                      Plot <span className="sr">the whole shelf</span>
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        </>
      )}

      <footer className="ft">
        <i className="trim a" aria-hidden="true" />
        <i className="trim b" aria-hidden="true" />
        <i className="trim c" aria-hidden="true" />
        <i className="trim d" aria-hidden="true" />
        <p className="ft-name">{site.name}</p>
        <p className="ft-line">
          {state === "ok"
            ? `${total} volumes on two sheets. End of drawing.`
            : "End of drawing."}
        </p>
        <nav aria-label="Footer">
          <button
            type="button"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })
            }
          >
            Back to the top
          </button>
          <Link to="/admin">Owner sign in</Link>
        </nav>
      </footer>

      {reader && openEntry && (
        <Reader
          key={reader.key}
          entry={openEntry}
          total={total}
          closing={reader.closing}
          mode={mode}
          reduced={reduced}
          compact={compact}
          origin={origin}
          onClose={close}
          onClosed={closed}
          onStep={stepBook}
        />
      )}
    </div>
  );
}
