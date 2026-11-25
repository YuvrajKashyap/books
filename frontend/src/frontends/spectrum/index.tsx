// Spectrum: white light crosses a prism and fans out into four shelves.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
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
  type Sort,
} from "../../shared/catalogue";
import { site, useTitle } from "../../shared/site";
import Bench, { type BenchApi } from "./Bench";
import Reader from "./Reader";
import { ANGLE, RAYS, hueKey, type Item, type Layout } from "./layout";
import "./spectrum.css";

const KEYS = ["identity", "wealth", "behavior", "misc"] as const;
const SHORT = ["Identity", "Wealth", "Behavior", "Misc."] as const;
type Arrange = Sort | "colour";

function useReducedMotion() {
  const [reduce, setReduce] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

export default function Spectrum() {
  const { books, state, reload } = useShelf();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const api = useRef<BenchApi | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Phones show two shelves at a time; this is which two.
  const [pair, setPair] = useState(0);

  const q = params.get("q") ?? "";
  const focus = KEYS.indexOf(
    (params.get("focus") ?? "") as (typeof KEYS)[number],
  );
  const sortParam = params.get("sort") ?? "shelf";
  const arrange: Arrange =
    sortParam === "colour" || sorts.some((s) => s.value === sortParam)
      ? (sortParam as Arrange)
      : "shelf";
  const layout: Layout =
    params.get("layout") === "covers" ? "covers" : "spines";
  const bookId = params.get("book");

  const patch = useCallback(
    (changes: Record<string, string | null>, push = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: !push },
      );
    },
    [setParams],
  );

  const items: Item[] = useMemo(
    () =>
      books.map((book) => {
        const art = bookArt(book);
        const shelf = focuses.indexOf(book.focus);
        return {
          book,
          art,
          shelf: shelf < 0 ? 3 : shelf,
          hue: hueKey(art.cloth),
        };
      }),
    [books],
  );
  const byId = useMemo(
    () => new Map(items.map((it) => [it.book.id, it])),
    [items],
  );

  const needle = q.trim();
  const matches = useMemo(
    () =>
      needle ? new Set(searchShelf(books, needle).map((b) => b.id)) : null,
    [books, needle],
  );

  // Four shelves in the chosen arrangement. While searching, the matches
  // gather at the head of each shelf, nearest the prism.
  const order: Item[][] = useMemo(() => {
    const sorted =
      arrange === "colour"
        ? books
            .map((b) => byId.get(b.id) as Item)
            .sort(
              (a, b) => a.hue - b.hue || a.art.title.localeCompare(b.art.title),
            )
        : sortShelf(books, arrange).map((b) => byId.get(b.id) as Item);
    return [0, 1, 2, 3].map((i) => {
      const row = sorted.filter((it) => it.shelf === i);
      if (!matches) return row;
      return [
        ...row.filter((it) => matches.has(it.book.id)),
        ...row.filter((it) => !matches.has(it.book.id)),
      ];
    });
  }, [books, byId, arrange, matches]);

  const counts = useMemo(
    () => [0, 1, 2, 3].map((i) => items.filter((it) => it.shelf === i).length),
    [items],
  );
  const hits = useMemo(
    () =>
      order.map((row) =>
        matches
          ? row.filter((it) => matches.has(it.book.id)).length
          : row.length,
      ),
    [order, matches],
  );
  const hitsInView = focus >= 0 ? hits[focus] : hits.reduce((a, b) => a + b, 0);
  const hitsAll = hits.reduce((a, b) => a + b, 0);
  const pages = useMemo(() => {
    let sum = 0;
    let known = 0;
    for (const it of items)
      if (it.art.pages) {
        sum += it.art.pages;
        known++;
      }
    return { sum, known };
  }, [items]);

  // A new search brings the bench back to where the matches gather.
  useEffect(() => {
    if (needle) api.current?.toStart();
  }, [needle, focus]);

  // The reader stays mounted while its book travels back to the shelf.
  const [shown, setShown] = useState<{ id: string; closing: boolean } | null>(
    null,
  );
  const origin = useRef<DOMRect | null>(null);
  const pushed = useRef(false);
  const openItem = bookId ? byId.get(bookId) : undefined;
  useEffect(() => {
    if (openItem) setShown({ id: openItem.book.id, closing: false });
    else {
      pushed.current = false;
      setShown((s) => (s && !s.closing ? { ...s, closing: true } : s));
    }
  }, [openItem]);
  const shownItem = shown ? byId.get(shown.id) : undefined;

  const open = useCallback(
    (id: string) => {
      origin.current = api.current?.rectOf(id) ?? null;
      pushed.current = true;
      patch({ book: id }, true);
    },
    [patch],
  );
  const close = useCallback(() => {
    if (pushed.current) navigate(-1);
    else patch({ book: null });
  }, [navigate, patch]);
  const exited = useCallback(() => {
    setShown((s) => {
      if (s && s.closing) {
        const id = s.id;
        requestAnimationFrame(() => api.current?.focusBook(id));
        return null;
      }
      return s;
    });
  }, []);

  const flat = useMemo(
    () => (focus >= 0 ? order[focus] : order.flat()).map((it) => it.book.id),
    [order, focus],
  );
  const at = shown ? flat.indexOf(shown.id) : -1;
  const step = useCallback(
    (dir: 1 | -1) => {
      if (at < 0 || flat.length < 2) return;
      patch({ book: flat[(at + dir + flat.length) % flat.length] });
    },
    [at, flat, patch],
  );

  useTitle(openItem ? openItem.art.title : undefined);
  useShelfKeys({
    paused: Boolean(bookId),
    search: () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    },
    enter: () => navigate("/admin"),
  });

  const total = items.length;
  const ready = state === "ok";
  const empty = ready && Boolean(matches) && hitsInView === 0;

  return (
    <div className="fx-spectrum" data-reading={shown ? "" : undefined}>
      <Bench
        state={state}
        reload={reload}
        order={order}
        matches={matches}
        total={total}
        focus={focus}
        pair={pair}
        layout={layout}
        byColour={arrange === "colour"}
        awayId={shown ? shown.id : null}
        paused={Boolean(shown)}
        reduce={reduce}
        pages={pages}
        api={api}
        onOpen={open}
      />

      <div className="sp-hud" inert={shown ? true : undefined}>
        <div className="sp-hud-row">
          <span className="sp-brand" aria-hidden="true">
            <svg viewBox="0 0 24 22" width="22" height="20">
              <path
                d="M12 1.5 22.5 20.5h-21Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M0 15l8.5-4" stroke="currentColor" strokeWidth="1" />
              <path d="M15 10l9-1" stroke={RAYS[0]} strokeWidth="1.2" />
              <path d="M15.6 11.4l8.4 2" stroke={RAYS[1]} strokeWidth="1.2" />
              <path d="M16.2 12.8l7.8 5" stroke={RAYS[2]} strokeWidth="1.2" />
              <path d="M16.8 14.2l6 7" stroke={RAYS[3]} strokeWidth="1.2" />
            </svg>
            <em>{site.name}</em>
          </span>
          <div className="sp-search" role="search">
            <Search size={15} strokeWidth={1.5} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={q}
              onChange={(e) => patch({ q: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape" && q) {
                  e.preventDefault();
                  patch({ q: null });
                }
              }}
              placeholder="Search title or author"
              aria-label="Search by title or author"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
            />
            {q ? (
              <button
                type="button"
                className="sp-icon sp-clear"
                onClick={() => patch({ q: null })}
                aria-label="Clear search"
              >
                <X size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : (
              <kbd className="sp-mono" aria-hidden="true">
                /
              </kbd>
            )}
          </div>
        </div>
        <div className="sp-hud-row sp-hud-tools">
          <div className="sp-cats" role="group" aria-label="Category">
            <button
              type="button"
              aria-pressed={focus < 0}
              onClick={() => patch({ focus: null })}
            >
              All <span className="sp-mono">{matches ? hitsAll : total}</span>
            </button>
            {focus < 0 && (
              <span
                className="sp-pairseg"
                role="group"
                aria-label="Shelves in view"
              >
                {[0, 1].map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={pair === p}
                    aria-label={
                      "Show the shelves " +
                      focuses[p * 2] +
                      " and " +
                      focuses[p * 2 + 1]
                    }
                    onClick={() => setPair(p)}
                  >
                    <i aria-hidden="true" style={{ background: RAYS[p * 2] }} />
                    <i
                      aria-hidden="true"
                      style={{ background: RAYS[p * 2 + 1] }}
                    />
                  </button>
                ))}
              </span>
            )}
            {focuses.map((name, i) => (
              <button
                key={name}
                type="button"
                aria-pressed={focus === i}
                aria-label={
                  name +
                  ", " +
                  (matches ? hits[i] + " matching of " : "") +
                  counts[i] +
                  " books"
                }
                onClick={() => patch({ focus: focus === i ? null : KEYS[i] })}
                style={{ ["--ray" as string]: RAYS[i] }}
              >
                <i aria-hidden="true" />
                <span className="sp-cat-long">{name}</span>
                <span className="sp-cat-short">{SHORT[i]}</span>{" "}
                <span className="sp-mono">{matches ? hits[i] : counts[i]}</span>
              </button>
            ))}
          </div>
          <label className="sp-select">
            <span className="sp-mono">Arrange</span>
            <select
              value={arrange}
              onChange={(e) =>
                patch({
                  sort: e.target.value === "shelf" ? null : e.target.value,
                })
              }
            >
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
              <option value="colour">By binding colour</option>
            </select>
          </label>
          <div className="sp-seg" role="group" aria-label="Turn the books">
            {(["spines", "covers"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={layout === v}
                onClick={() => patch({ layout: v === "spines" ? null : v })}
              >
                {v === "spines" ? "Spines" : "Covers"}
              </button>
            ))}
          </div>
        </div>
        <p className="sp-live" role="status" aria-live="polite">
          {ready && matches
            ? hitsInView +
              " of " +
              (focus >= 0 ? counts[focus] : total) +
              " books match"
            : ""}
        </p>
      </div>

      {empty && !shown && (
        <div className="sp-empty" role="status">
          <span className="sp-mono">no light passes</span>
          <p>
            Nothing {focus >= 0 ? "on this shelf" : "on the bench"} matches “
            {needle}”.
          </p>
          <div>
            <button
              type="button"
              className="sp-btn"
              onClick={() => {
                patch({ q: null });
                searchRef.current?.focus();
              }}
            >
              Clear the search
            </button>
            {focus >= 0 && hitsAll > 0 && (
              <button
                type="button"
                className="sp-btn"
                onClick={() => patch({ focus: null })}
              >
                Show {hitsAll} on other shelves
              </button>
            )}
          </div>
        </div>
      )}

      {arrange === "colour" && ready && !shown && (
        <p className="sp-mono sp-arranged">
          Arranged by the colour of each binding, not by subject or merit.
        </p>
      )}

      {shown && shownItem && (
        <Reader
          item={shownItem}
          origin={origin.current}
          shelfAngle={ANGLE[layout]}
          closing={shown.closing}
          reduce={reduce}
          rectOf={(id) => api.current?.rectOf(id) ?? null}
          onClose={close}
          onExited={exited}
          onStep={flat.length > 1 && at >= 0 ? step : null}
          place={at >= 0 ? at + 1 + " of " + flat.length : ""}
        />
      )}
    </div>
  );
}
