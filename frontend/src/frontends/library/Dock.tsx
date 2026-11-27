// The way around the shelf, shared by every room. On a desktop it is a tall
// book spine standing at the left edge: the rooms at its head, the four
// categories as its bands (their names run down the spine, the way titles
// do), and order, layout and the room's own instrument at its foot. Each
// room binds it in its own material: leather and gold leaf in the study,
// navy cloth and gilt in the rotunda, glass and amber light in gravity. On a
// phone it becomes a slim bar at the top that steps aside while you scroll
// down and comes back when you scroll up.
//
// Everything it sets lives in the address (q, focus, sort, layout, view),
// which every view already reads. A view lends it one instrument through
// <DockSlot>, and keeps clear of it with var(--fx-rail-w) (left, desktop)
// and var(--fx-top-h) (top, phones).
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownUp,
  Check,
  Grid2x2,
  KeyRound,
  Lamp,
  Orbit,
  Rotate3d,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import {
  focuses,
  searchShelf,
  sorts,
  useShelf,
  type Focus,
  type Sort,
} from "../../shared/catalogue";
import { useShelfView } from "./ViewSwitch";
import { views, type ViewSlug } from "./views";
import "./dock.css";

const icons = { lamp: Lamp, rotunda: Rotate3d, gravity: Orbit };
// Each room's own idea of a starting layout.
export const defaultLayout: Record<ViewSlug, "spines" | "covers"> = {
  lamp: "spines",
  rotunda: "spines",
  gravity: "covers",
};
const shortFocus: Record<Focus, string> = {
  "Identity + Discipline": "Identity",
  "Wealth + Execution": "Wealth",
  "Behavior + Mental Models": "Behavior",
  "Misc.": "Misc.",
};
const PHONE = "(max-width: 860px)";

// Where a view's own instrument goes.
const SlotContext = createContext<HTMLElement | null>(null);
export function DockSlotProvider({
  slot,
  children,
}: {
  slot: HTMLElement | null;
  children: ReactNode;
}) {
  return <SlotContext.Provider value={slot}>{children}</SlotContext.Provider>;
}
export function DockSlot({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  return slot ? createPortal(children, slot) : null;
}

// For a view's "/" shortcut and its empty-search actions.
const SEARCH_EVENT = "fx-shelf-search";
export function focusShelfSearch() {
  window.dispatchEvent(new Event(SEARCH_EVENT));
}

function useMedia(query: string) {
  const [on, setOn] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const set = () => setOn(m.matches);
    set();
    m.addEventListener("change", set);
    return () => m.removeEventListener("change", set);
  }, [query]);
  return on;
}

// Everything both shapes need: what is chosen, and how to change it.
function useControls() {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useShelfView();
  const { books, state } = useShelf();
  const q = params.get("q") ?? "";
  const focus = focuses.find((f) => f === params.get("focus")) ?? null;
  const sort: Sort =
    sorts.find((s) => s.value === params.get("sort"))?.value ?? "shelf";
  const layoutParam = params.get("layout");
  const layout =
    layoutParam === "covers" || layoutParam === "spines"
      ? layoutParam
      : defaultLayout[view];

  // Typing stays in the field; the address follows it.
  const [typed, setTyped] = useState(q);
  const own = useRef(q);
  useEffect(() => {
    if (q !== own.current) setTyped(q);
    own.current = q;
  }, [q]);

  function write(change: (p: URLSearchParams) => void, push = false) {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace: !push, preventScrollReset: true });
  }

  const found = useMemo(
    () => (q.trim() ? searchShelf(books, q) : books),
    [books, q],
  );
  const counts = useMemo(() => {
    const by = new Map<string, number>();
    for (const b of found) by.set(b.focus, (by.get(b.focus) ?? 0) + 1);
    return by;
  }, [found]);
  const matching = focus ? (counts.get(focus) ?? 0) : found.length;

  return {
    view,
    setView,
    reading: params.has("book"),
    ready: state === "ok",
    total: books.length,
    searching: Boolean(q.trim()),
    found: found.length,
    matching,
    counts,
    typed,
    setQuery(value: string) {
      setTyped(value);
      own.current = value;
      write((p) => (value ? p.set("q", value) : p.delete("q")));
    },
    focus,
    setFocus(f: Focus | null) {
      write((p) => (f ? p.set("focus", f) : p.delete("focus")), true);
    },
    sort,
    setSort(s: Sort) {
      write((p) => (s === "shelf" ? p.delete("sort") : p.set("sort", s)));
    },
    layout,
    setLayout(l: "spines" | "covers") {
      write((p) =>
        l === defaultLayout[view] ? p.delete("layout") : p.set("layout", l),
      );
    },
  };
}
type Controls = ReturnType<typeof useControls>;

export function Dock({
  skin,
  onSlot,
}: {
  skin: ViewSlug;
  onSlot: (el: HTMLElement | null) => void;
}) {
  const phone = useMedia(PHONE);
  const c = useControls();
  return phone ? (
    <TopBar c={c} skin={skin} onSlot={onSlot} />
  ) : (
    <Spine c={c} skin={skin} onSlot={onSlot} />
  );
}

// Publish how much room the nav takes, for the views to keep clear of.
function usePublish(left: string, top: string) {
  useLayoutEffect(() => {
    const s = document.documentElement.style;
    s.setProperty("--fx-rail-w", left);
    s.setProperty("--fx-top-h", top);
    s.setProperty("--fx-dock-h", "0px");
    return () => {
      s.removeProperty("--fx-rail-w");
      s.removeProperty("--fx-top-h");
      s.removeProperty("--fx-dock-h");
    };
  }, [left, top]);
}

function Mats() {
  return (
    <>
      {views.map((v) => (
        <span key={v.slug} className="fx-nav-mat" data-k={v.slug} />
      ))}
    </>
  );
}

function Spines(props: { size?: number }) {
  const s = props.size ?? 16;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 2.5v11M5.5 2.5v11M8.5 3.5v10M11.2 3.2l2.6 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function countText(c: Controls) {
  if (!c.ready) return "";
  if (c.searching || c.focus) return `${c.matching} of ${c.total}`;
  return `${c.total} books`;
}

/* ---------------------------------------------------------------- spine */

function Spine({
  c,
  skin,
  onSlot,
}: {
  c: Controls;
  skin: ViewSlug;
  onSlot: (el: HTMLElement | null) => void;
}) {
  usePublish("104px", "0px");
  const root = useRef<HTMLElement>(null);
  const findBtn = useRef<HTMLButtonElement>(null);
  const sortBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<null | "find" | "sort">(null);
  const [at, setAt] = useState(0); // where the open panel hangs from

  function show(which: "find" | "sort") {
    const btn = which === "find" ? findBtn.current : sortBtn.current;
    setAt(btn ? btn.offsetTop : 0);
    setOpen((o) => (o === which ? null : which));
  }
  function close(back = true) {
    const was = open;
    setOpen(null);
    if (back) (was === "sort" ? sortBtn : findBtn).current?.focus();
  }

  useEffect(() => {
    const go = () => {
      setAt(findBtn.current?.offsetTop ?? 0);
      setOpen("find");
      requestAnimationFrame(() => input.current?.select());
    };
    window.addEventListener(SEARCH_EVENT, go);
    return () => window.removeEventListener(SEARCH_EVENT, go);
  }, []);
  useEffect(() => {
    if (!open) return;
    if (open === "find") input.current?.focus();
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useEffect(() => {
    if (c.reading) setOpen(null);
  }, [c.reading]);

  const bands: { f: Focus | null; name: string; n: number | undefined }[] = [
    { f: null, name: "All", n: c.searching ? c.found : c.total },
    ...focuses.map((f) => ({ f, name: shortFocus[f], n: c.counts.get(f) })),
  ];

  return (
    <aside
      ref={root}
      className={"fx-rail" + (c.reading ? " is-away" : "")}
      data-skin={skin}
      aria-label="Shelf"
      inert={c.reading}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div className="fx-rail-spine">
        <Mats />
        <i className="fx-rail-cap" aria-hidden="true" />

        <div className="fx-rail-rooms" role="group" aria-label="Room">
          {views.map((v) => {
            const Icon = icons[v.slug];
            return (
              <button
                key={v.slug}
                type="button"
                className="fx-rail-room"
                aria-pressed={v.slug === c.view}
                aria-label={v.name}
                onClick={() => c.setView(v.slug)}
              >
                <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                <span className="fx-rail-tip" aria-hidden="true">
                  <b>{v.name}</b>
                  <small>{v.hint}</small>
                </span>
              </button>
            );
          })}
        </div>

        <i className="fx-rail-band-rule" aria-hidden="true" />

        <button
          ref={findBtn}
          type="button"
          className="fx-rail-find"
          aria-label={c.typed ? `Search: ${c.typed}` : "Search"}
          aria-expanded={open === "find"}
          data-on={c.searching || undefined}
          onClick={() => show("find")}
        >
          <Search size={17} strokeWidth={1.5} aria-hidden="true" />
          {c.searching && c.ready && (
            <em className="fx-rail-badge" aria-hidden="true">
              {c.found}
            </em>
          )}
          <span className="fx-rail-tip" aria-hidden="true">
            <b>Search</b>
            <small>Press /</small>
          </span>
        </button>

        <nav className="fx-rail-bands" aria-label="Category">
          {bands.map((b) => (
            <button
              key={b.name}
              type="button"
              className="fx-rail-band"
              aria-pressed={c.focus === b.f}
              aria-label={`${b.f ?? "Every book"}${c.ready ? `, ${b.n ?? 0}` : ""}`}
              data-empty={(c.ready && !b.n) || undefined}
              onClick={() => c.setFocus(b.f)}
            >
              <span className="fx-rail-name">{b.name}</span>
              <em>{c.ready ? (b.n ?? 0) : ""}</em>
            </button>
          ))}
        </nav>

        <i className="fx-rail-band-rule" aria-hidden="true" />

        <div className="fx-rail-foot">
          <button
            ref={sortBtn}
            type="button"
            className="fx-rail-tool"
            aria-label={`Order: ${sorts.find((s) => s.value === c.sort)!.label}`}
            aria-haspopup="listbox"
            aria-expanded={open === "sort"}
            data-on={c.sort !== "shelf" || undefined}
            onClick={() => show("sort")}
          >
            <ArrowDownUp size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="fx-rail-tip" aria-hidden="true">
              <b>Order</b>
              <small>{sorts.find((s) => s.value === c.sort)!.label}</small>
            </span>
          </button>
          <div className="fx-rail-layout" role="group" aria-label="Layout">
            {(["spines", "covers"] as const).map((l) => (
              <button
                key={l}
                type="button"
                className="fx-rail-tool"
                aria-pressed={c.layout === l}
                aria-label={l === "spines" ? "Spines" : "Covers"}
                onClick={() => c.setLayout(l)}
              >
                {l === "spines" ? (
                  <Spines />
                ) : (
                  <Grid2x2 size={16} strokeWidth={1.5} aria-hidden="true" />
                )}
                <span className="fx-rail-tip" aria-hidden="true">
                  <b>{l === "spines" ? "Spines" : "Covers"}</b>
                </span>
              </button>
            ))}
          </div>
          <div className="fx-dock-slot fx-rail-slot" ref={onSlot} />
          <Link
            className="fx-rail-tool fx-rail-owner"
            to="/admin"
            aria-label="Owner sign in"
          >
            <KeyRound size={15} strokeWidth={1.5} aria-hidden="true" />
            <span className="fx-rail-tip" aria-hidden="true">
              <b>Owner sign in</b>
            </span>
          </Link>
        </div>
        <i className="fx-rail-cap is-foot" aria-hidden="true" />
      </div>

      {open === "find" && (
        <div
          className="fx-rail-fly fx-rail-search"
          style={{ top: Math.max(0, at - 18) }}
          role="search"
        >
          <label>
            <Search size={18} strokeWidth={1.5} aria-hidden="true" />
            <input
              ref={input}
              type="search"
              value={c.typed}
              placeholder="Title or author"
              aria-label="Search title or author"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => c.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") close();
              }}
            />
            {c.typed && (
              <button
                type="button"
                className="fx-nav-clear"
                aria-label="Clear search"
                onClick={() => {
                  c.setQuery("");
                  input.current?.focus();
                }}
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </label>
          <p aria-live="polite">
            <span>{countText(c)}</span>
            <kbd>Esc</kbd>
          </p>
        </div>
      )}

      {open === "sort" && (
        <SortList
          className="fx-rail-fly fx-rail-sort"
          style={{ top: Math.max(0, at - 40) }}
          value={c.sort}
          onPick={(s) => {
            c.setSort(s);
            close();
          }}
          onClose={() => close()}
        />
      )}
    </aside>
  );
}

// The list of orders. Arrows move, Enter picks, Escape closes.
function SortList({
  className,
  style,
  value,
  onPick,
  onClose,
}: {
  className: string;
  style?: CSSProperties;
  value: Sort;
  onPick: (s: Sort) => void;
  onClose: () => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [at, setAt] = useState(
    Math.max(
      0,
      sorts.findIndex((s) => s.value === value),
    ),
  );
  useEffect(() => list.current?.focus(), []);
  return (
    <ul
      ref={list}
      className={className}
      style={style}
      role="listbox"
      aria-label="Order"
      tabIndex={-1}
      aria-activedescendant={`fx-sort-${at}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setAt((i) => Math.min(sorts.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setAt((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick(sorts[at].value);
        } else if (e.key === "Tab") {
          onClose();
        }
      }}
    >
      <li className="fx-nav-head" role="presentation">
        Order
      </li>
      {sorts.map((s, i) => (
        <li
          key={s.value}
          id={`fx-sort-${i}`}
          role="option"
          aria-selected={s.value === value}
          data-at={i === at || undefined}
          onPointerEnter={() => setAt(i)}
          onClick={() => onPick(s.value)}
        >
          <Check className="fx-nav-tick" size={13} aria-hidden="true" />
          <span>{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------- top bar */

function TopBar({
  c,
  skin,
  onSlot,
}: {
  c: Controls;
  skin: ViewSlug;
  onSlot: (el: HTMLElement | null) => void;
}) {
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState(false);
  const [tucked, setTucked] = useState(false);
  const [height, setHeight] = useState(64);
  usePublish("0px", height + "px");

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setHeight(
        Math.ceil(
          el.querySelector(".fx-bar-main")!.getBoundingClientRect().height + 16,
        ),
      ),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Step aside while scrolling down; come back on the way up.
  useEffect(() => {
    let last = window.scrollY;
    const on = () => {
      const y = window.scrollY;
      const d = y - last;
      if (Math.abs(d) < 6) return;
      const busy = sheet || root.current?.contains(document.activeElement);
      setTucked(!busy && d > 0 && y > 120);
      last = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [sheet]);

  useEffect(() => {
    const go = () => {
      setTucked(false);
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener(SEARCH_EVENT, go);
    return () => window.removeEventListener(SEARCH_EVENT, go);
  }, []);
  useEffect(() => {
    if (!sheet) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setSheet(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [sheet]);
  useEffect(() => {
    if (c.reading) setSheet(false);
  }, [c.reading]);

  const tuned =
    (c.focus ? 1 : 0) +
    (c.sort !== "shelf" ? 1 : 0) +
    (c.layout !== defaultLayout[c.view] ? 1 : 0);

  return (
    <header
      ref={root}
      className={
        "fx-bar" +
        (c.reading ? " is-away" : "") +
        (tucked ? " is-tucked" : "") +
        (sheet ? " is-open" : "")
      }
      data-skin={skin}
      inert={c.reading}
      onKeyDown={(e) => {
        if (e.key === "Escape" && sheet) {
          e.stopPropagation();
          setSheet(false);
        }
      }}
    >
      <div className="fx-bar-main">
        <Mats />
        <div className="fx-bar-row">
          <div className="fx-bar-rooms" role="group" aria-label="Room">
            {views.map((v) => {
              const Icon = icons[v.slug];
              return (
                <button
                  key={v.slug}
                  type="button"
                  aria-pressed={v.slug === c.view}
                  aria-label={v.name}
                  onClick={() => c.setView(v.slug)}
                >
                  <Icon size={17} strokeWidth={1.5} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <label className="fx-bar-search">
            <Search size={16} strokeWidth={1.5} aria-hidden="true" />
            <input
              ref={input}
              type="search"
              value={c.typed}
              placeholder="Search"
              aria-label="Search title or author"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => c.setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") input.current?.blur();
              }}
            />
            {c.typed ? (
              <button
                type="button"
                className="fx-nav-clear"
                aria-label="Clear search"
                onClick={() => c.setQuery("")}
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <button
            type="button"
            className="fx-bar-tune"
            aria-label="Category, order and layout"
            aria-expanded={sheet}
            onClick={() => setSheet((s) => !s)}
          >
            <SlidersHorizontal size={17} strokeWidth={1.5} aria-hidden="true" />
            {tuned > 0 && <em aria-hidden="true">{tuned}</em>}
          </button>
        </div>
        <div className="fx-bar-under">
          <span className="fx-bar-count" aria-live="polite">
            {c.focus ? shortFocus[c.focus] + " · " : ""}
            {countText(c)}
          </span>
          <div className="fx-dock-slot fx-bar-slot" ref={onSlot} />
        </div>
      </div>

      {sheet && (
        <div className="fx-bar-sheet">
          <Mats />
          <p className="fx-nav-head">Category</p>
          <div className="fx-bar-cats">
            {[null, ...focuses].map((f) => (
              <button
                key={f ?? "all"}
                type="button"
                aria-pressed={c.focus === f}
                onClick={() => c.setFocus(f)}
              >
                <span>{f ?? "Every book"}</span>
                <em>
                  {c.ready
                    ? f
                      ? (c.counts.get(f) ?? 0)
                      : c.searching
                        ? c.found
                        : c.total
                    : ""}
                </em>
              </button>
            ))}
          </div>
          <p className="fx-nav-head">Order</p>
          <div className="fx-bar-chips">
            {sorts.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={c.sort === s.value}
                onClick={() => c.setSort(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="fx-bar-sheet-foot">
            <div className="fx-bar-layout" role="group" aria-label="Layout">
              {(["spines", "covers"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={c.layout === l}
                  onClick={() => c.setLayout(l)}
                >
                  {l === "spines" ? (
                    <Spines />
                  ) : (
                    <Grid2x2 size={16} strokeWidth={1.5} aria-hidden="true" />
                  )}
                  <span>{l === "spines" ? "Spines" : "Covers"}</span>
                </button>
              ))}
            </div>
            <Link className="fx-bar-owner" to="/admin">
              <KeyRound size={14} strokeWidth={1.5} aria-hidden="true" />
              Owner
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
