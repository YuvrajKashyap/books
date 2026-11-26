// Small shared pieces for the owner rooms: the context every room reads,
// the ?book= sheet, dialog behaviour and a few formatters.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { Book, BookFields, Library, Owner } from "../../shared/owner";

export type Rooms = {
  owner: Owner;
  library: Library;
  // Opens the editor for a book id, or "new".
  open: (id: string) => void;
  reduced: boolean;
};
export const RoomsContext = createContext<Rooms | null>(null);
export function useRooms() {
  const value = useContext(RoomsContext);
  if (!value) throw Error("Rooms context missing");
  return value;
}

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const change = () => setMatch(list.matches);
    change();
    list.addEventListener("change", change);
    return () => list.removeEventListener("change", change);
  }, [query]);
  return match;
}

// The editor lives in the address as ?book=<id>. Opening pushes history so
// Back closes it; closing goes back when we were the ones who pushed.
export function useBookParam() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = params.get("book");
  function open(bookId: string) {
    const q = new URLSearchParams(params);
    q.set("book", bookId);
    navigate({ search: "?" + q.toString() }, { state: { sheet: true } });
  }
  function close() {
    const state = location.state as { sheet?: boolean } | null;
    if (state?.sheet) navigate(-1);
    else {
      const q = new URLSearchParams(params);
      q.delete("book");
      setParams(q, { replace: true });
    }
  }
  return { id, open, close };
}

// Modal behaviour for a sheet: focus moves in, Tab stays in, Escape asks to
// close, the page behind stops scrolling, and focus returns afterwards.
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  onEscape: () => void,
) {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  useEffect(() => {
    const panel = ref.current;
    const before = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    if (panel && !panel.contains(document.activeElement))
      panel.focus({ preventScroll: true });
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        escape.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      root.style.overflow = overflow;
      before?.focus?.({ preventScroll: true });
    };
  }, [ref]);
}

export function fieldsOf(book: Book): BookFields {
  return {
    title: book.title,
    author: book.author,
    focus: book.focus,
    status: book.status,
    format: book.format,
    notes: book.notes,
    progress: book.progress,
    rating: book.rating,
    finished: book.finished,
    cover: book.cover,
    source: book.source,
  };
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
// "2024-03-09" -> "9 March 2024". Never shifts across time zones.
export function longDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return Number(m[3]) + " " + months[Number(m[2]) - 1] + " " + m[1];
}
export function shortDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return (
    String(Number(m[3])).padStart(2, "0") +
    " " +
    months[Number(m[2]) - 1].slice(0, 3)
  );
}
// A history stamp, shown in the owner's local time when it parses.
export function stamp(at: string) {
  const time = new Date(at);
  if (Number.isNaN(time.getTime())) return at;
  return time.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function today() {
  const now = new Date();
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}

// The short names the rotation instrument prints.
export function shortFocus(focus: string) {
  return focus.split(" + ")[0];
}

// Five stars drawn from a 1 to 5 rating in halves.
export function Stars({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="stars" role="img" aria-label={value + " out of 5"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cx(
            "star",
            value >= n ? "is-full" : value >= n - 0.5 && "is-half",
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
