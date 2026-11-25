// The public catalogue: loading it, searching and ordering it, and packing it
// onto shelves. The page component only arranges what these return.
import { useEffect, useState, type RefObject } from "react";
import type { ShelfBook } from "../components";
import { bindingDepth, displayTitle, jacketFor } from "../../../shared/artwork";

const phoneQuery =
  "(max-width: 700px), (pointer: coarse) and (max-width: 950px) and (max-height: 540px)";
const frontRow = [
  "Shoe Dog",
  "Atomic Habits",
  "A Brief History of Time",
  "Meditations",
  "Deep Work",
  "The Daily Laws",
  "Poor Charlie's Almanack",
];
const titleOrder = new Intl.Collator("en", { numeric: true });
function shelfOrder(a: ShelfBook, b: ShelfBook) {
  const rank = (x: ShelfBook) => {
    const i = frontRow.indexOf(x.title);
    return i < 0 ? 100 : i;
  };
  return rank(a) - rank(b) || a.title.localeCompare(b.title);
}

export function useShelfBooks() {
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setState("loading");
    fetch("/api/shelf", { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = await r.json();
        setBooks((data.books as ShelfBook[]).sort(shelfOrder));
        setState("ok");
      })
      .catch(() => {
        if (!ac.signal.aborted) setState("error");
      });
    return () => ac.abort();
  }, [attempt]);
  return { books, state, reload: () => setAttempt((n) => n + 1) };
}

export function usePhone() {
  const [phone, setPhone] = useState(
    () => window.matchMedia(phoneQuery).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(phoneQuery);
    const update = () => setPhone(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  return phone;
}

// "/" focuses the search field. Typing the owner word opens the sign-in page.
export function useShelfKeys(
  paused: boolean,
  search: RefObject<HTMLInputElement | null>,
  enter: () => void,
) {
  useEffect(() => {
    const word = "secret";
    let matched = 0;
    const reset = () => {
      matched = 0;
    };
    function key(e: KeyboardEvent) {
      const target = e.target;
      if (
        paused ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        e.isComposing ||
        (target instanceof HTMLElement &&
          (target.isContentEditable ||
            target.closest('input,textarea,select,[role="textbox"]')))
      ) {
        reset();
        return;
      }
      if (e.repeat) return;
      if (e.key === "/") {
        e.preventDefault();
        search.current?.focus();
        reset();
        return;
      }
      if (e.key === "Shift") return;
      const letter = e.key.toLowerCase();
      matched =
        letter === word[matched] ? matched + 1 : Number(letter === word[0]);
      if (matched === word.length) {
        reset();
        enter();
      }
    }
    window.addEventListener("keydown", key);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", reset);
    };
    // The caller passes a fresh callback each render; only pausing matters.
  }, [paused]);
}

export function searchShelf(books: ShelfBook[], query: string) {
  const needle = query.trim().toLowerCase();
  return books.filter((b) =>
    (displayTitle(b.title) + " " + b.author).toLowerCase().includes(needle),
  );
}

// Sorts in place and returns the same array.
export function sortShelf(found: ShelfBook[], sort: string) {
  const byTitle = (a: ShelfBook, b: ShelfBook) =>
    titleOrder.compare(displayTitle(a.title), displayTitle(b.title));
  if (sort === "title") found.sort(byTitle);
  if (sort === "author")
    found.sort(
      (a, b) => a.author.localeCompare(b.author, "en") || byTitle(a, b),
    );
  if (sort === "short" || sort === "long")
    found.sort((a, b) => {
      const x = jacketFor(a)?.pages,
        y = jacketFor(b)?.pages;
      if (x === undefined || y === undefined)
        return (
          Number(y !== undefined) - Number(x !== undefined) || byTitle(a, b)
        );
      return (sort === "short" ? x - y : y - x) || byTitle(a, b);
    });
  return found;
}

// Pack by physical width, leaving clearance for exactly one pulled book.
export function packBays(books: ShelfBook[], width: number, covers: boolean) {
  const packed: ShelfBook[][] = [];
  const capacity = Math.max(115, width - (covers ? 64 : 165));
  let occupied = 0;
  for (const book of books) {
    const pitch = covers ? 124 : bindingDepth(book) + 2;
    if (!packed.length || occupied + pitch > capacity) {
      packed.push([]);
      occupied = 0;
    }
    packed[packed.length - 1].push(book);
    occupied += pitch;
  }
  return packed;
}
