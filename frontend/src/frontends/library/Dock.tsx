// The one set of controls every view shares. It sits in the same place in
// every room, with the same things in the same order, and only its finish
// changes: brass on walnut in the study, gilt on midnight in the rotunda,
// glass and amber light in gravity. It stays put while the rooms change
// behind it, so the way around never moves.
//
// Everything it sets lives in the address (q, focus, sort, layout, view),
// which every view already reads. A view may lend the dock one instrument of
// its own through <DockSlot>, and pads its foot by var(--fx-dock-h).
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  Grid2x2,
  KeyRound,
  Lamp,
  Library,
  Orbit,
  Rotate3d,
  Search,
  X,
} from "lucide-react";
import "@fontsource-variable/dm-sans/wght.css";
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

// For a view's "/" shortcut.
export function focusShelfSearch() {
  const input = document.querySelector<HTMLInputElement>(
    ".fx-dock-search input",
  );
  input?.focus();
  input?.select();
}

export function Dock({
  skin,
  onSlot,
}: {
  skin: ViewSlug;
  onSlot: (el: HTMLElement | null) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [view, setView] = useShelfView();
  const { books, state } = useShelf();
  const root = useRef<HTMLDivElement>(null);
  const reading = params.has("book");

  const q = params.get("q") ?? "";
  const focusParam = params.get("focus");
  const focus = focuses.find((f) => f === focusParam) ?? null;
  const sort =
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
  function setQuery(value: string) {
    setTyped(value);
    own.current = value;
    write((p) => (value ? p.set("q", value) : p.delete("q")));
  }

  const counts = useMemo(() => {
    const by = new Map<string, number>();
    for (const b of books) by.set(b.focus, (by.get(b.focus) ?? 0) + 1);
    return by;
  }, [books]);
  const matching = useMemo(() => {
    const within = focus ? books.filter((b) => b.focus === focus) : books;
    return q.trim() ? searchShelf(within, q).length : within.length;
  }, [books, focus, q]);
  const ready = state === "ok";

  // Tell the views how much of the foot the dock takes.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty(
        "--fx-dock-h",
        Math.ceil(el.getBoundingClientRect().height + 24) + "px",
      );
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--fx-dock-h");
    };
  }, []);

  return (
    <div
      ref={root}
      className={"fx-dock" + (reading ? " is-away" : "")}
      data-skin={skin}
      inert={reading}
    >
      <nav className="fx-dock-bar" aria-label="Shelf controls">
        {views.map((v) => (
          <span key={v.slug} className="fx-dock-mat" data-k={v.slug} />
        ))}
        <div className="fx-dock-views" role="group" aria-label="Room">
          {views.map((v) => {
            const Icon = icons[v.slug];
            return (
              <button
                key={v.slug}
                type="button"
                data-view={v.slug}
                aria-pressed={v.slug === view}
                title={v.hint}
                onClick={() => setView(v.slug)}
              >
                <Icon size={15} strokeWidth={1.6} aria-hidden="true" />
                <span>{v.name}</span>
              </button>
            );
          })}
        </div>

        <label className="fx-dock-search">
          <Search size={15} strokeWidth={1.6} aria-hidden="true" />
          <input
            type="search"
            value={typed}
            placeholder="Search"
            aria-label="Search title or author"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && typed) {
                e.stopPropagation();
                setQuery("");
              }
            }}
          />
          {typed ? (
            <button
              type="button"
              className="fx-dock-clear"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : (
            <kbd aria-hidden="true">/</kbd>
          )}
        </label>

        <Menu
          className="fx-dock-focus"
          label="Category"
          icon={<Library size={15} strokeWidth={1.6} aria-hidden="true" />}
          value={focus ?? ""}
          shown={
            <>
              <b>{focus ? shortFocus[focus] : "All"}</b>
              <em aria-live="polite">
                {ready
                  ? q.trim() || focus
                    ? `${matching} of ${books.length}`
                    : books.length
                  : ""}
              </em>
            </>
          }
          options={[
            { value: "", label: "Every book", note: ready ? books.length : "" },
            ...focuses.map((f) => ({
              value: f,
              label: f,
              note: ready ? (counts.get(f) ?? 0) : "",
            })),
          ]}
          onPick={(v) =>
            write((p) => (v ? p.set("focus", v) : p.delete("focus")), true)
          }
        />

        <Menu
          className="fx-dock-sort"
          label="Order"
          icon={<ArrowDownUp size={15} strokeWidth={1.6} aria-hidden="true" />}
          value={sort}
          shown={<b>{sorts.find((s) => s.value === sort)!.label}</b>}
          options={sorts.map((s) => ({ value: s.value, label: s.label }))}
          onPick={(v) =>
            write((p) => (v === "shelf" ? p.delete("sort") : p.set("sort", v)))
          }
        />

        <div className="fx-dock-layout" role="group" aria-label="Layout">
          {(["spines", "covers"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={layout === l}
              aria-label={l === "spines" ? "Spines" : "Covers"}
              title={l === "spines" ? "Spines" : "Covers"}
              onClick={() =>
                write((p) =>
                  l === defaultLayout[view]
                    ? p.delete("layout")
                    : p.set("layout", l),
                )
              }
            >
              {l === "spines" ? (
                <Spines aria-hidden="true" />
              ) : (
                <Grid2x2 size={15} strokeWidth={1.6} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        <div className="fx-dock-slot" ref={onSlot} />

        <Link
          className="fx-dock-owner"
          to="/admin"
          aria-label="Owner sign in"
          title="Owner sign in"
        >
          <KeyRound size={14} strokeWidth={1.6} aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}

function Spines(props: { "aria-hidden": "true" }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" {...props}>
      <path
        d="M2.5 2.5v11M5.5 2.5v11M8.5 3.5v10M11.2 3.2l2.6 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// A small list that opens from the dock. Arrows move, Enter picks, Escape
// and a click elsewhere close it.
function Menu({
  className,
  label,
  icon,
  value,
  shown,
  options,
  onPick,
}: {
  className: string;
  label: string;
  icon: ReactNode;
  value: string;
  shown: ReactNode;
  options: { value: string; label: string; note?: ReactNode }[];
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    setAt(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  function pick(i: number) {
    onPick(options[i].value);
    setOpen(false);
    button.current?.focus();
  }

  return (
    <div className={"fx-dock-menu " + className} ref={box}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {icon}
        <span className="fx-dock-shown">{shown}</span>
        <ChevronDown className="fx-dock-chev" size={13} aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={list}
          id={id}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`${id}-${at}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAt((i) => Math.min(options.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAt((i) => Math.max(0, i - 1));
            } else if (e.key === "Home") {
              e.preventDefault();
              setAt(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setAt(options.length - 1);
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick(at);
            } else if (e.key === "Escape" || e.key === "Tab") {
              if (e.key === "Escape") e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              button.current?.focus();
            }
          }}
        >
          <li className="fx-dock-menu-head" role="presentation">
            {label}
          </li>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              data-at={i === at || undefined}
              onPointerEnter={() => setAt(i)}
              onClick={() => pick(i)}
            >
              <Check className="fx-dock-tick" size={13} aria-hidden="true" />
              <span>{o.label}</span>
              {o.note !== undefined && o.note !== "" && <em>{o.note}</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
