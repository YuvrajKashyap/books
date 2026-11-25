// One Lamp. A dark study, a tall walnut case, and a single filament bulb the
// visitor can take hold of. Everything visible is lit from where it hangs.
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "@fontsource-variable/dm-sans/wght.css";
import "./lamplit.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { LayoutGrid, Library, Search, X } from "lucide-react";
import {
  bookArt,
  focuses,
  searchShelf,
  sortShelf,
  sorts,
  useShelf,
  useShelfKeys,
  type BookArt,
  type Focus,
  type ShelfBook,
  type Sort,
} from "../../shared/catalogue";
import { site, useTitle } from "../../shared/site";
import { Bookcase, pack, type Layout } from "./Bookcase";
import { LampView } from "./LampView";
import { Reader } from "./Reader";
import type { Lamp } from "./lamp";

type Reading = { id: string; closing: boolean; fly: boolean };

export default function OneLamp() {
  const { books, state, reload } = useShelf();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [env] = useState(() => ({
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    lite:
      window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720,
  }));

  const q = params.get("q") ?? "";
  const focusParam = params.get("focus");
  const focus: Focus | null = focuses.find((f) => f === focusParam) ?? null;
  const sortParam = params.get("sort");
  const sort: Sort = sorts.find((s) => s.value === sortParam)?.value ?? "shelf";
  const layout: Layout =
    params.get("layout") === "covers" ? "covers" : "spines";
  const bookId = params.get("book");

  const patch = useCallback(
    (changes: Record<string, string | null>) =>
      setParams(
        (old) => {
          const next = new URLSearchParams(old);
          for (const [k, v] of Object.entries(changes))
            if (v) next.set(k, v);
            else next.delete(k);
          return next;
        },
        { replace: true, state: location.state, preventScrollReset: true },
      ),
    [setParams, location.state],
  );

  const lampRef = useRef<Lamp | null>(null);
  const bookEls = useRef(new Map<string, HTMLDivElement>());
  const shelvesRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const corniceRef = useRef<HTMLDivElement>(null);
  const pedimentRef = useRef<HTMLElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);

  const [on, setOn] = useState(true);
  const [adjusted, setAdjusted] = useState(false);
  const [width, setWidth] = useState(0);
  const [switched, setSwitched] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);

  const arts = useMemo(() => {
    const m = new Map<string, BookArt>();
    for (const b of books) m.set(b.id, bookArt(b));
    return m;
  }, [books]);
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of books) m.set(b.focus, (m.get(b.focus) ?? 0) + 1);
    return m;
  }, [books]);
  const pages = useMemo(() => {
    let sum = 0;
    let known = 0;
    for (const a of arts.values())
      if (a.pages) {
        sum += a.pages;
        known++;
      }
    return { sum, known };
  }, [arts]);

  // A category change happens in two beats: the other books sink back into
  // the dark, then the case closes up around what is left.
  const [shownFocus, setShownFocus] = useState<Focus | null>(focus);
  const [gen, setGen] = useState(0);
  useEffect(() => {
    if (focus === shownFocus) return;
    const t = window.setTimeout(
      () => {
        setShownFocus(focus);
        setGen((g) => g + 1);
      },
      focus !== null && !env.reduced ? 470 : 0,
    );
    return () => window.clearTimeout(t);
  }, [focus, shownFocus, env.reduced]);
  const leaving = focus !== shownFocus && focus !== null ? focus : null;

  // The turning class only lives as long as the row of dominoes does.
  useEffect(() => {
    if (!switched) return;
    const t = window.setTimeout(() => setSwitched(false), 2000);
    return () => window.clearTimeout(t);
  }, [switched, layout]);

  const { order, matches } = useMemo(() => {
    const sorted = sortShelf(books, sort);
    const kept = shownFocus
      ? sorted.filter((b) => b.focus === shownFocus)
      : sorted;
    if (!q.trim()) return { order: kept, matches: null as ShelfBook[] | null };
    const found = searchShelf(kept, q);
    const ids = new Set(found.map((b) => b.id));
    // The light gathers what it found at the top of the case.
    return {
      order: [...found, ...kept.filter((b) => !ids.has(b.id))],
      matches: found,
    };
  }, [books, sort, shownFocus, q]);
  const matchIds = useMemo(
    () => (matches ? new Set(matches.map((b) => b.id)) : null),
    [matches],
  );

  const ok = state === "ok";
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const fit = () => setWidth(el.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ok]);
  const packing = useMemo(
    () => (width ? pack(order, arts, width, layout) : null),
    [order, arts, width, layout],
  );

  // ---- the lamp follows what the visitor is doing ------------------------

  useEffect(() => {
    const lamp = lampRef.current;
    if (!lamp) return;
    const stops = [pedimentRef.current, corniceRef.current, floorRef.current]
      .filter((el): el is HTMLElement => Boolean(el))
      .map((el) => lamp.follow(el));
    return () => stops.forEach((stop) => stop());
  }, [ok, env]);

  useEffect(() => {
    const lamp = lampRef.current;
    if (!lamp) return;
    const row = packing?.rows[0];
    if (!matches?.length || !row || !packing) {
      lamp.setSearchTarget(null);
      return;
    }
    const last = row[Math.min(matches.length, row.length) - 1];
    let x = last.x + last.w + 46;
    if (x > packing.width - 54) x = packing.width / 2;
    lamp.setSearchTarget({ x, y: packing.shelfH - packing.boardH + 12 });
  }, [matches, packing]);

  useEffect(() => {
    if (!q.trim() || !ok) return;
    const el = shelvesRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const bar = corniceRef.current?.offsetHeight ?? 100;
    if (top < bar - 6 || top > window.innerHeight * 0.55)
      window.scrollTo({
        top: window.scrollY + top - bar - 10,
        behavior: env.reduced ? "auto" : "smooth",
      });
  }, [q, ok, env.reduced]);

  useEffect(() => {
    const t = window.setTimeout(() => setAdjusted(!on), on ? 0 : 700);
    return () => window.clearTimeout(t);
  }, [on]);

  // ---- the reader ---------------------------------------------------------

  useEffect(() => {
    if (!ok) return;
    if (bookId && byId.has(bookId))
      setReading((r) =>
        r && r.id === bookId && !r.closing
          ? r
          : { id: bookId, closing: false, fly: r ? r.fly : true },
      );
    else {
      setReading((r) => (r ? { ...r, closing: true } : null));
      if (bookId) patch({ book: null });
    }
  }, [bookId, ok, byId, patch]);

  const isReading = Boolean(reading && !reading.closing);
  useEffect(() => {
    const lamp = lampRef.current;
    if (!lamp) return;
    if (!isReading) {
      lamp.setReadingTarget(null);
      return;
    }
    const vw = document.documentElement.clientWidth;
    const small = vw < 720;
    lamp.setReadingTarget({
      x: small ? vw * 0.17 : vw / 2 - Math.min(vw * 0.3, 380),
      y: window.innerHeight * (small ? 0.1 : 0.15),
    });
  }, [isReading]);

  const open = useCallback(
    (id: string) => {
      peek(null);
      setParams(
        (old) => {
          const next = new URLSearchParams(old);
          next.set("book", id);
          return next;
        },
        { state: { lamplitOpened: true }, preventScrollReset: true },
      );
    },
    [setParams],
  );
  const close = useCallback(() => {
    const st = location.state as { lamplitOpened?: boolean } | null;
    if (st?.lamplitOpened) navigate(-1);
    else patch({ book: null });
  }, [location.state, navigate, patch]);
  const step = useCallback(
    (dir: 1 | -1) => {
      if (!reading || !order.length) return;
      const at = order.findIndex((b) => b.id === reading.id);
      const next = order[(Math.max(at, 0) + dir + order.length) % order.length];
      patch({ book: next.id });
    },
    [reading, order, patch],
  );
  const closed = useCallback(() => {
    setReading((r) => {
      if (r) {
        const el = bookEls.current.get(r.id);
        window.requestAnimationFrame(() =>
          el
            ?.querySelector<HTMLElement>(".bk-hit")
            ?.focus({ preventScroll: true }),
        );
      }
      return null;
    });
  }, []);
  const origin = useCallback((id: string) => {
    const el = bookEls.current.get(id);
    if (!el || !el.querySelector(".bk-box")) return null;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0)
      return null;
    return r;
  }, []);

  // ---- small things -------------------------------------------------------

  function peek(el: HTMLElement | null, title?: string, author?: string) {
    const tip = peekRef.current;
    if (!tip) return;
    if (!el || !title) {
      tip.classList.remove("is-shown");
      return;
    }
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const bar = corniceRef.current?.getBoundingClientRect().bottom ?? 0;
    const below = r.top < Math.max(bar, 0) + 84;
    (tip.children[0] as HTMLElement).textContent = title;
    (tip.children[1] as HTMLElement).textContent = author ?? "";
    tip.style.left =
      Math.max(130, Math.min(vw - 130, r.left + r.width / 2)) + "px";
    tip.style.top = (below ? r.bottom + 12 : r.top - 12) + "px";
    tip.classList.toggle("is-below", below);
    tip.classList.add("is-shown");
  }
  const peekStable = useRef(peek);
  peekStable.current = peek;
  const onPeek = useCallback(
    (el: HTMLElement | null, title?: string, author?: string) =>
      peekStable.current(el, title, author),
    [],
  );

  useShelfKeys({
    paused: Boolean(reading),
    search: () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    },
    enter: () => navigate("/admin"),
  });
  const readingBook = reading ? byId.get(reading.id) : undefined;
  const readingArt = reading ? arts.get(reading.id) : undefined;
  useTitle(isReading && readingArt ? readingArt.title : undefined);

  const total = books.length;
  const empty = Boolean(matches && matches.length === 0);
  let status = total + " books";
  if (matches)
    status = matches.length + " of " + order.length + " in the light";
  else if (shownFocus) status = order.length + " books in " + shownFocus;

  const rootClass =
    "fx-lamplit is-" +
    layout +
    (on ? "" : " is-off") +
    (adjusted ? " is-adjusted" : "") +
    (reading ? " is-reading" : "") +
    (env.reduced ? " is-calm" : "") +
    (env.lite ? " is-lite" : "") +
    (switched ? " was-switched" : "") +
    (gen % 2 ? " gen-a" : " gen-b") +
    (ok ? " is-ready" : "");

  return (
    <div className={rootClass}>
      <LampView
        lampRef={lampRef}
        ready={ok}
        on={on}
        reduced={env.reduced}
        lite={env.lite}
        onPull={() => setOn((v) => !v)}
      />

      <div className="room" aria-hidden="true" />
      <div className="page" inert={isReading}>
        <header className="pediment" ref={pedimentRef}>
          <div className="pediment-wood" aria-hidden="true" />
          <div className="name-wrap">
            <span className="name-shadow" aria-hidden="true">
              {site.name}
            </span>
            <h1 className="name">{site.name}</h1>
          </div>
          <p className="lede">
            {ok
              ? `A personal library. ${total} books in four categories, kept under one lamp.`
              : "A personal library, kept under one lamp."}
          </p>
          <p className="hint">
            <span>The lamp is yours</span>
            {env.reduced
              ? "Pull its chain to put the light out."
              : "Take hold of it and let it swing. Pull its chain to put the light out."}
          </p>
        </header>

        {ok && (
          <main className="case">
            <div className="cornice" ref={corniceRef}>
              <div className="cornice-wood" aria-hidden="true" />
              <div className="cornice-light" aria-hidden="true" />
              <div className="tools">
                <div className="find">
                  <Search size={15} aria-hidden="true" />
                  <input
                    ref={searchRef}
                    type="search"
                    value={q}
                    placeholder="Search title or author"
                    aria-label="Search the shelf by title or author"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    onChange={(e) => patch({ q: e.target.value || null })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && matches?.length) {
                        e.preventDefault();
                        open(matches[0].id);
                      }
                      if (e.key === "Escape" && q) {
                        e.preventDefault();
                        patch({ q: null });
                      }
                    }}
                  />
                  {q ? (
                    <button
                      type="button"
                      className="find-clear"
                      aria-label="Clear search"
                      onClick={() => {
                        patch({ q: null });
                        searchRef.current?.focus();
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  ) : (
                    <kbd aria-hidden="true">/</kbd>
                  )}
                </div>
                <p className="status" role="status" aria-live="polite">
                  {status}
                </p>
                <label className="sort">
                  <span>Order</span>
                  <select
                    value={sort}
                    onChange={(e) =>
                      patch({
                        sort:
                          e.target.value === "shelf" ? null : e.target.value,
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
                <div
                  className="turn"
                  role="group"
                  aria-label="How the books stand"
                >
                  <button
                    type="button"
                    aria-pressed={layout === "spines"}
                    onClick={() => {
                      if (layout !== "spines") setSwitched(true);
                      patch({ layout: null });
                    }}
                  >
                    <Library size={15} aria-hidden="true" />
                    <span>Spines</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={layout === "covers"}
                    onClick={() => {
                      if (layout !== "covers") setSwitched(true);
                      patch({ layout: "covers" });
                    }}
                  >
                    <LayoutGrid size={15} aria-hidden="true" />
                    <span>Covers</span>
                  </button>
                </div>
              </div>
              <div className="plates" role="group" aria-label="Category">
                <button
                  type="button"
                  className="plate"
                  aria-pressed={focus === null}
                  onClick={() => patch({ focus: null })}
                >
                  <span>All</span>
                  <b>{total}</b>
                </button>
                {focuses.map((f) => (
                  <button
                    type="button"
                    className="plate"
                    key={f}
                    aria-pressed={focus === f}
                    onClick={() => patch({ focus: focus === f ? null : f })}
                  >
                    <span>{f}</span>
                    <b>{counts.get(f) ?? 0}</b>
                  </button>
                ))}
              </div>
              {empty && (
                <div className="empty" role="status">
                  <p>
                    The light found nothing for “{q.trim()}”
                    {shownFocus ? " in " + shownFocus : ""}. No title or author
                    here matches.
                  </p>
                  <div>
                    <button type="button" onClick={() => patch({ q: null })}>
                      Clear the search
                    </button>
                    {shownFocus && (
                      <button
                        type="button"
                        onClick={() => patch({ focus: null })}
                      >
                        Look in every category
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="case-body">
              <div className="case-inner" ref={innerRef}>
                {packing && (
                  <Bookcase
                    packing={packing}
                    layout={layout}
                    matchIds={matchIds}
                    leaving={leaving}
                    outId={reading ? reading.id : null}
                    lampRef={lampRef}
                    bookEls={bookEls}
                    rootRef={shelvesRef}
                    onOpen={open}
                    onPeek={onPeek}
                  />
                )}
              </div>
            </div>

            <footer className="plinth">
              <div className="plinth-wood" aria-hidden="true" />
              <div className="plinth-plate">
                <p className="plinth-name">{site.name}</p>
                <p className="plinth-count">
                  {total} books on {packing ? packing.rows.length : 0} shelves
                  {pages.known > 0 &&
                    `. ${pages.sum.toLocaleString("en")} pages across the ${pages.known} with a known edition`}
                  .
                </p>
              </div>
              <p className="plinth-out">
                That is the whole case.
                <button type="button" onClick={() => setOn((v) => !v)}>
                  {on ? "Put the light out" : "Light the lamp"}
                </button>
              </p>
              <Link className="owner" to="/admin">
                Owner sign in
              </Link>
            </footer>
          </main>
        )}
        {ok && (
          <div className="floor" ref={floorRef} aria-hidden="true">
            <div className="floor-boards" />
            <div className="floor-pool" />
          </div>
        )}
      </div>

      {state === "loading" && (
        <p className="wait" role="status">
          <span>Warming the filament</span>
        </p>
      )}
      {state === "error" && (
        <div className="wait is-error" role="alert">
          <span>The lamp would not light</span>
          <p>The shelf could not be loaded.</p>
          <button type="button" onClick={reload}>
            Try again
          </button>
          <Link className="owner" to="/admin">
            Owner sign in
          </Link>
        </div>
      )}

      <div className="peek" ref={peekRef} aria-hidden="true">
        <b />
        <i />
      </div>

      {reading && readingBook && readingArt && (
        <Reader
          book={readingBook}
          art={readingArt}
          place={
            Math.max(
              0,
              order.findIndex((b) => b.id === reading.id),
            ) + 1
          }
          total={order.length}
          closing={reading.closing}
          fly={reading.fly}
          layout={layout}
          reduced={env.reduced}
          origin={origin}
          lampRef={lampRef}
          onClose={close}
          onClosed={closed}
          onStep={step}
        />
      )}
    </div>
  );
}
