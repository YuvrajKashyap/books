// Gravity Well: the public shelf, standing on a sheet of spacetime that every
// book bends in proportion to its page count.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Search, X } from "lucide-react";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import {
  bookArt,
  focuses,
  searchShelf,
  sortShelf,
  sorts,
  useShelf,
  useShelfKeys,
} from "../../shared/catalogue";
import type { BookArt, Sort } from "../../shared/catalogue";
import { site, useTitle } from "../../shared/site";
import { Reader } from "./Reader";
import { Stage } from "./Stage";
import type { Probe, StageApi } from "./Stage";
import { DrawnGrid, StaticShelf } from "./StaticShelf";
import { OVERRUN, STEP, focusSlug, planShelf, viewFor } from "./layout";
import type { Entry, Layout } from "./layout";
import "./gravity.css";

const num = (n: number) => n.toLocaleString("en-US");

function useMedia(query: string) {
  const [on, setOn] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const change = () => setOn(mq.matches);
    change();
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, [query]);
  return on;
}

// Viewport size. On phones the height only ever grows for a given width, so
// the scene does not jump as the browser bars slide away.
function useViewport(lite: boolean) {
  const read = () => ({
    w: document.documentElement.clientWidth || window.innerWidth,
    h: window.innerHeight,
  });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const resize = () =>
      setSize((cur) => {
        const next = read();
        if (lite && next.w === cur.w) next.h = Math.max(cur.h, next.h);
        return next.w === cur.w && next.h === cur.h ? cur : next;
      });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lite]);
  return size;
}

type Shown = { id: string; closing: boolean; seq: number };

export default function GravityWell() {
  const { books, state, reload } = useShelf();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const lite = useMedia("(max-width: 760px), (pointer: coarse)");
  const [glFailed, setGlFailed] = useState(false);
  const [skyName, setSkyName] = useState(false);
  const nameRef = useRef<HTMLHeadingElement>(null);
  // Entrances are animations; this ends them by the clock, so the name and
  // the controls can never be left half shown.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 1700);
    return () => window.clearTimeout(t);
  }, []);
  const gl = !reduced && !glFailed;
  const size = useViewport(lite);
  const view = useMemo(() => {
    const v = viewFor(size.w, size.h);
    return { w: size.w, h: size.h, P: v.P, originY: v.originY, cols: v.cols };
  }, [size.w, size.h]);

  // ---- the view, kept in the address ----
  const q = params.get("q") ?? "";
  const focusIdx = focuses.findIndex(
    (f) => focusSlug(f) === params.get("focus"),
  );
  const sort: Sort =
    sorts.find((s) => s.value === params.get("sort"))?.value ?? "shelf";
  const layout: Layout =
    params.get("layout") === "spines" ? "spines" : "covers";
  const bookId = params.get("book");

  const patch = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes))
            if (v) next.set(k, v);
            else next.delete(k);
          return next;
        },
        { replace: true, state: location.state },
      );
    },
    [setParams, location.state],
  );
  const reform = (changes: Record<string, string | null>) => {
    patch(changes);
    if (gl) window.scrollTo({ top: 0 });
  };

  // ---- the shelf ----
  const arts = useMemo(() => {
    const map = new Map<string, BookArt>();
    for (const b of books) map.set(b.id, bookArt(b));
    return map;
  }, [books]);

  const stats = useMemo(() => {
    const per = focuses.map((f) => ({ focus: f, count: 0, pages: 0 }));
    let pages = 0;
    let measured = 0;
    for (const b of books) {
      const p = arts.get(b.id)?.pages;
      const row = per.find((r) => r.focus === b.focus);
      if (row) row.count++;
      if (p) {
        pages += p;
        measured++;
        if (row) row.pages += p;
      }
    }
    return { per, pages, measured };
  }, [books, arts]);

  const { entries, matches } = useMemo(() => {
    const inFocus =
      focusIdx < 0 ? books : books.filter((b) => b.focus === focuses[focusIdx]);
    const sorted = sortShelf(inFocus, sort);
    const found = q.trim()
      ? new Set(searchShelf(sorted, q).map((b) => b.id))
      : null;
    const ordered = found
      ? [
          ...sorted.filter((b) => found.has(b.id)),
          ...sorted.filter((b) => !found.has(b.id)),
        ]
      : sorted;
    const list: Entry[] = [];
    for (const b of ordered) {
      const art = arts.get(b.id);
      if (art) list.push({ book: b, art, match: !found || found.has(b.id) });
    }
    return { entries: list, matches: found ? found.size : null };
  }, [books, arts, focusIdx, sort, q]);

  const plan = useMemo(
    () =>
      planShelf(entries, {
        cols: view.cols,
        layout,
        orbit: gl ? focusIdx : -1,
      }),
    [entries, view.cols, layout, gl, focusIdx],
  );
  const searching = matches !== null;
  const empty = matches === 0;

  // ---- the reader ----
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const stageApi = useRef<StageApi | null>(null);
  const probe = useRef<Probe | null>(null);
  const origin = useRef<{ id: string; rect: DOMRect } | null>(null);
  const seq = useRef(0);
  const [shown, setShown] = useState<Shown | null>(null);
  const valid = bookId && state === "ok" && arts.has(bookId) ? bookId : null;

  useEffect(() => {
    if (valid) {
      setShown((cur) =>
        cur && !cur.closing
          ? { ...cur, id: valid }
          : { id: valid, closing: false, seq: ++seq.current },
      );
      return;
    }
    setShown((cur) => (cur && !cur.closing ? { ...cur, closing: true } : cur));
  }, [valid]);

  useEffect(() => {
    if (!shown?.closing) return;
    const id = shown.id;
    const t = window.setTimeout(
      () => {
        setShown(null);
        requestAnimationFrame(() => {
          const el = rootRef.current?.querySelector<HTMLElement>(
            `[data-book="${CSS.escape(id)}"]`,
          );
          const hit =
            el instanceof HTMLButtonElement
              ? el
              : el?.querySelector<HTMLElement>(".gw-hit");
          hit?.focus({ preventScroll: true });
        });
      },
      reduced ? 0 : 560,
    );
    return () => window.clearTimeout(t);
  }, [shown, reduced]);

  // A book reached by a link or by previous and next: bring its shelf near.
  const readingId = shown && !shown.closing ? shown.id : null;
  useEffect(() => {
    if (!readingId || origin.current?.id === readingId) return;
    const slot = plan.byId.get(readingId);
    if (slot && gl) stageApi.current?.toRow(slot.row, false);
    // Only when the open book changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingId]);

  const openBook = useCallback(
    (id: string, rect: DOMRect) => {
      origin.current = { id, rect };
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("book", id);
          return next;
        },
        { state: { gravityReader: true } },
      );
    },
    [setParams],
  );
  const closeBook = useCallback(() => {
    const st = location.state as { gravityReader?: boolean } | null;
    if (st?.gravityReader) navigate(-1);
    else patch({ book: null });
  }, [location.state, navigate, patch]);

  useShelfKeys({
    paused: Boolean(shown),
    search: () => searchRef.current?.focus(),
    enter: () => navigate("/admin"),
  });
  const openArt = readingId ? arts.get(readingId) : undefined;
  useTitle(openArt?.title);

  const shownBook = shown ? books.find((b) => b.id === shown.id) : undefined;
  const shownArt = shown ? arts.get(shown.id) : undefined;
  const shownSlot = shown ? plan.byId.get(shown.id) : undefined;
  const at = shownSlot ? shownSlot.index : -1;
  const prev = at > 0 ? plan.slots[at - 1] : undefined;
  const next =
    at >= 0 && at < plan.slots.length - 1 ? plan.slots[at + 1] : undefined;

  const [first, ...rest] = site.name.split(" ");
  const maxS = Math.max(0, plan.rows - 1 + OVERRUN);
  const chosen = focusIdx >= 0 ? focuses[focusIdx] : null;

  const strata = (variant: "rail" | "chips") => (
    <div
      className={"gw-strata is-" + variant}
      role="group"
      aria-label="Category"
    >
      {variant === "rail" && <p className="gw-label">Strata</p>}
      <button
        type="button"
        aria-pressed={focusIdx < 0}
        onClick={() => reform({ focus: null })}
      >
        <span>All</span>
        <b>{state === "ok" ? books.length : "--"}</b>
        <i style={{ transform: "scaleX(1)" }} />
      </button>
      {stats.per.map((row, i) => (
        <button
          key={row.focus}
          type="button"
          aria-pressed={focusIdx === i}
          onClick={() => reform({ focus: focusSlug(row.focus) })}
        >
          <span>{row.focus}</span>
          <b>{state === "ok" ? row.count : "--"}</b>
          <i
            style={{
              transform: `scaleX(${stats.pages ? (row.pages / stats.pages).toFixed(3) : 0})`,
            }}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={
        "fx-gravity" +
        (gl ? " is-gl" : " is-static") +
        (lite ? " is-lite" : "") +
        (readingId ? " is-reading" : "") +
        (state === "ok" ? " is-ready" : "") +
        (settled ? " is-settled" : "") +
        (gl && skyName && !lite ? " has-skyname" : "")
      }
    >
      <div className="gw-page" inert={Boolean(readingId)}>
        {gl ? (
          <Stage
            plan={plan}
            layout={layout}
            lite={lite}
            view={view}
            phase={state}
            searching={searching}
            pulse={`${q}|${focusIdx}|${sort}|${layout}`}
            reading={Boolean(readingId)}
            awayId={shown?.id ?? null}
            probe={probe}
            api={stageApi}
            onOpen={openBook}
            nameRef={nameRef}
            onFail={() => setGlFailed(true)}
            onSkyName={setSkyName}
          />
        ) : (
          <DrawnGrid />
        )}

        <main
          className="gw-track"
          style={
            gl
              ? { height: `calc(100vh + ${Math.round(maxS * STEP)}px)` }
              : undefined
          }
        >
          <header className="gw-hero">
            <p className="gw-kicker">
              <i className="gw-dot" aria-hidden="true" />
              {site.monogram} · A personal library
            </p>
            <h1 className="gw-name" ref={nameRef}>
              <span>{first}</span> <em>{rest.join(" ")}</em>
            </h1>
            {state === "ok" && (
              <>
                <p className="gw-lede">
                  A personal library of {books.length} books in four categories.
                  They rest on a sheet of spacetime, and each one bends it by
                  its page count.
                </p>
                <dl className="gw-facts">
                  <div>
                    <dt>Bodies</dt>
                    <dd>{books.length}</dd>
                  </div>
                  <div>
                    <dt>Categories</dt>
                    <dd>{focuses.length}</dd>
                  </div>
                  <div>
                    <dt>Pages, across {stats.measured} measured</dt>
                    <dd>{num(stats.pages)}</dd>
                  </div>
                </dl>
                {gl && (
                  <p className="gw-cue" aria-hidden="true">
                    Scroll to travel the shelves
                  </p>
                )}
              </>
            )}
            {state === "loading" && (
              <p className="gw-lede gw-wait" role="status">
                Reading the shelf
              </p>
            )}
            {state === "error" && (
              <div className="gw-fault" role="alert">
                <p>The shelf did not load.</p>
                <button type="button" className="gw-button" onClick={reload}>
                  Try again
                </button>
              </div>
            )}
          </header>

          {!gl && state === "ok" && (
            <StaticShelf
              slots={plan.slots}
              layout={layout}
              searching={searching}
              awayId={shown?.id ?? null}
              onOpen={openBook}
            />
          )}
        </main>

        {state === "ok" && empty && (
          <div className="gw-empty" role="status">
            <p className="gw-label">No mass detected</p>
            <p className="gw-empty-line">
              Nothing {chosen ? `in ${chosen}` : "on the shelf"} matches “
              {q.trim()}”.
            </p>
            <div>
              <button
                type="button"
                className="gw-button"
                onClick={() => {
                  reform({ q: null });
                  searchRef.current?.focus();
                }}
              >
                Clear the search
              </button>
              {chosen && (
                <button
                  type="button"
                  className="gw-button is-quiet"
                  onClick={() => reform({ focus: null })}
                >
                  Search all categories
                </button>
              )}
            </div>
          </div>
        )}

        {gl && strata("rail")}

        <div className="gw-console">
          <form
            className="gw-search"
            role="search"
            onSubmit={(e) => e.preventDefault()}
          >
            <Search size={15} strokeWidth={1.5} aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              value={q}
              placeholder="Search title or author"
              aria-label="Search by title or author"
              onChange={(e) => reform({ q: e.target.value || null })}
              onKeyDown={(e) => {
                if (e.key === "Escape" && q) {
                  e.preventDefault();
                  reform({ q: null });
                }
              }}
            />
            {q ? (
              <button
                type="button"
                className="gw-clear"
                aria-label="Clear the search"
                onClick={() => {
                  reform({ q: null });
                  searchRef.current?.focus();
                }}
              >
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : (
              <kbd aria-hidden="true">/</kbd>
            )}
          </form>

          <p className="gw-count" aria-live="polite">
            {state !== "ok"
              ? ""
              : matches !== null
                ? `${matches} of ${plan.slots.length} match`
                : `${plan.slots.length} ${plan.slots.length === 1 ? "body" : "bodies"}`}
          </p>

          {strata("chips")}

          <label className="gw-sort">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) =>
                reform({
                  sort: e.target.value === "shelf" ? null : e.target.value,
                })
              }
            >
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <div className="gw-layout" role="group" aria-label="Show books by">
            <button
              type="button"
              aria-pressed={layout === "covers"}
              onClick={() => reform({ layout: null })}
            >
              Covers
            </button>
            <button
              type="button"
              aria-pressed={layout === "spines"}
              onClick={() => reform({ layout: "spines" })}
            >
              Spines
            </button>
          </div>
        </div>

        <footer className="gw-foot">
          <p className="gw-kicker">
            <i className="gw-dot" aria-hidden="true" />
            Past the last shelf
          </p>
          <p className="gw-foot-name">
            <span>{first}</span> <em>{rest.join(" ")}</em>
          </p>
          {state === "ok" && (
            <>
              <p className="gw-lede">
                {books.length} books in four categories. {num(stats.pages)}{" "}
                pages across the {stats.measured} with a known count. Without
                them the sheet lies flat.
              </p>
              <table className="gw-ledger">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Books</th>
                    <th scope="col">Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.per.map((row) => (
                    <tr key={row.focus}>
                      <th scope="row">{row.focus}</th>
                      <td>{row.count}</td>
                      <td>{num(row.pages)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <div className="gw-foot-links">
            <button
              type="button"
              className="gw-button"
              onClick={() =>
                window.scrollTo({
                  top: 0,
                  behavior: reduced ? "auto" : "smooth",
                })
              }
            >
              Return to the first shelf
            </button>
            <Link className="gw-owner" to="/admin">
              Owner sign in
            </Link>
          </div>
          <p className="gw-colophon">
            {site.name} · {site.owner}
          </p>
        </footer>
      </div>

      {shown && shownBook && shownArt && (
        <Reader
          key={shown.seq}
          book={shownBook}
          art={shownArt}
          slot={shownSlot}
          layout={layout}
          closing={shown.closing}
          still={reduced}
          origin={origin.current?.id === shown.id ? origin.current.rect : null}
          returnRect={() =>
            gl
              ? (stageApi.current?.restRect(shown.id) ?? null)
              : (rootRef.current
                  ?.querySelector(`[data-book="${CSS.escape(shown.id)}"]`)
                  ?.getBoundingClientRect() ?? null)
          }
          prev={prev && { id: prev.id, title: prev.art.title }}
          next={next && { id: next.id, title: next.art.title }}
          probe={probe}
          onNav={(id) => patch({ book: id })}
          onClose={closeBook}
        />
      )}
    </div>
  );
}
