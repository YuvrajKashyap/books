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
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
} from "../../../../shared/catalogue";
import { site, useTitle } from "../../../../shared/site";
import { focusShelfSearch } from "../../Dock";
import { Bookcase, pack, type Layout } from "./Bookcase";
import { Pull, type PullHandle } from "./Pull";
import { LampView } from "./LampView";
import { Reader } from "./Reader";
import { Walnut } from "./Walnut";
import { navRoom, type Lamp } from "./lamp";

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
  const pullRef = useRef<PullHandle | null>(null);

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

  // A change of stance (from the dock) turns the books over like a row of
  // dominoes. Noted while rendering, so the class lands with the new layout.
  const [seenLayout, setSeenLayout] = useState(layout);
  if (seenLayout !== layout) {
    setSeenLayout(layout);
    setSwitched(true);
  }
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

  // A new arrangement of the case puts any book that is out back first.
  useEffect(() => {
    pullRef.current?.release();
  }, [packing]);

  // ---- the lamp follows what the visitor is doing ------------------------

  useEffect(() => {
    const lamp = lampRef.current;
    if (!lamp) return;
    const stops = [
      pedimentRef.current,
      corniceRef.current,
      floorRef.current,
      pullRef.current?.el() ?? null,
    ]
      .filter((el): el is HTMLElement => Boolean(el))
      .map((el) => lamp.follow(el));
    // The lamp hangs above the case: the bulb never drops below the foot of
    // the pediment, so it rests over the crown and never over a spine. Once
    // the pediment has scrolled away it tucks up at the top of the window,
    // beside the rows.
    lamp.setCeiling(pedimentRef.current);
    return () => {
      stops.forEach((stop) => stop());
      lamp.setCeiling(null);
    };
  }, [ok, env]);

  useEffect(() => {
    const lamp = lampRef.current;
    if (!lamp) return;
    if (!matches?.length || !packing) {
      lamp.setSearchTarget(null);
      return;
    }
    lamp.setSearchTarget({ y: packing.shelfH * 0.42 });
  }, [matches, packing]);

  useEffect(() => {
    // A search brings the top of the case into view, where the light
    // gathers what it found (or says it found nothing).
    if (!q.trim() || !ok) return;
    const el = corniceRef.current ?? shelvesRef.current;
    if (!el) return;
    // On a phone the nav bar lies across the top of the window.
    const bar = navRoom().top;
    const top = el.getBoundingClientRect().top;
    if (top < bar || top > window.innerHeight * 0.4)
      window.scrollTo({
        top: window.scrollY + top - bar - 12,
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
    // The reader stands right of the nav rail (desktop only; it is 0 on
    // a phone, where the top bar steps away while a book is open).
    const left = navRoom().left;
    const vw = document.documentElement.clientWidth;
    const w = vw - left;
    const small = vw < 720;
    lamp.setReadingTarget({
      x: small ? vw * 0.17 : left + w / 2 - Math.min(w * 0.3, 380),
      y: window.innerHeight * (small ? 0.1 : 0.15),
    });
  }, [isReading]);

  const open = useCallback(
    (id: string) => {
      const pull = pullRef.current;
      if (pull?.current() === id) pull.hold(id);
      else pull?.release();
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
        window.requestAnimationFrame(() => {
          const hit = el?.querySelector<HTMLElement>(".bk-hit");
          if (!hit) return;
          // Focus comes home with the book; it must not draw it out again.
          hit.dataset.quiet = "1";
          hit.focus({ preventScroll: true });
        });
      }
      return null;
    });
  }, []);
  const origin = useCallback((id: string) => {
    // A book already drawn out flies from where it is held.
    const held = pullRef.current?.take(id);
    if (held) return { rect: held, facing: true };
    const el = bookEls.current.get(id);
    if (!el || !el.querySelector(".bk-box")) return null;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0)
      return null;
    return { rect: r, facing: false };
  }, []);
  const bounds = useCallback(() => {
    const box = shelvesRef.current?.getBoundingClientRect();
    // A book drawn out stays clear of the shared nav: the rail down the
    // left on a desktop, the bar across the top on a phone.
    const nav = navRoom();
    return {
      left: Math.max(box ? box.left : 0, nav.left),
      right: box ? box.right : document.documentElement.clientWidth,
      top: nav.top,
      bottom: window.innerHeight,
    };
  }, []);

  // ---- small things -------------------------------------------------------

  useShelfKeys({
    paused: Boolean(reading),
    search: focusShelfSearch,
    enter: () => navigate("/admin"),
  });
  const readingBook = reading ? byId.get(reading.id) : undefined;
  const readingArt = reading ? arts.get(reading.id) : undefined;
  useTitle(isReading && readingArt ? readingArt.title : undefined);

  const total = books.length;
  const empty = Boolean(matches && matches.length === 0);

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
          <div className="pediment-wood" aria-hidden="true">
            <Walnut seed={11} />
          </div>
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
              <div className="cornice-wood" aria-hidden="true">
                <Walnut seed={23} />
              </div>
              <div className="cornice-light" aria-hidden="true" />
              {empty && (
                <div className="empty" role="status">
                  <p>
                    The light found nothing for “{q.trim()}”
                    {shownFocus ? " in " + shownFocus : ""}. No title or author
                    here matches.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => patch({ q: null, focus: null })}
                    >
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
                    pullRef={pullRef}
                    onOpen={open}
                  />
                )}
              </div>
            </div>

            <footer className="plinth">
              <div className="plinth-wood" aria-hidden="true">
                <Walnut seed={37} />
              </div>
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
        </div>
      )}

      <Pull ref={pullRef} bounds={bounds} onOpen={open} />

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
