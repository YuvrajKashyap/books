// The public catalogue for every frontend: loading it, searching it and
// ordering it. No presentation lives here.
import { useEffect, useState } from "react";
import type { Book } from "../../../shared/model";
import { focuses } from "../../../shared/categories";
import { cachedNote, readNote, readOwnerNote } from "./bookNote";
import { displayTitle, jacketFor, type Jacket } from "./artwork";

export { focuses };
export type Focus = (typeof focuses)[number];
export type ShelfBook = Pick<
  Book,
  "id" | "title" | "author" | "focus" | "cover"
>;
export type Note = {
  brief: string;
  synopsis: string;
  author: string;
  source?: string;
};
export const sorts = [
  { value: "shelf", label: "Shelf order" },
  { value: "title", label: "Title" },
  { value: "author", label: "Author" },
  { value: "short", label: "Shortest first" },
  { value: "long", label: "Longest first" },
] as const;
export type Sort = (typeof sorts)[number]["value"];

// The owner's chosen front row; everything else follows by title.
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

let cached: ShelfBook[] | undefined;
export function useShelf() {
  const [books, setBooks] = useState<ShelfBook[]>(cached ?? []);
  const [state, setState] = useState<"loading" | "ok" | "error">(
    cached ? "ok" : "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (cached && !attempt) return;
    const ac = new AbortController();
    setState("loading");
    fetch("/api/shelf", { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = await r.json();
        cached = (data.books as ShelfBook[]).sort(shelfOrder);
        setBooks(cached);
        setState("ok");
      })
      .catch(() => {
        if (!ac.signal.aborted) setState("error");
      });
    return () => ac.abort();
  }, [attempt]);
  return { books, state, reload: () => setAttempt((n) => n + 1) };
}

export function searchShelf<T extends ShelfBook>(books: T[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return books.slice();
  return books.filter((b) =>
    (displayTitle(b.title) + " " + b.author).toLowerCase().includes(needle),
  );
}

// Returns a new array; "shelf" keeps the order given.
export function sortShelf<T extends ShelfBook>(books: T[], sort: Sort) {
  const found = books.slice();
  const byTitle = (a: T, b: T) =>
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

const cloths = [
  "#394c55",
  "#a04735",
  "#455739",
  "#886031",
  "#344561",
  "#724857",
  "#3a6463",
  "#66543a",
];
export type BookArt = {
  title: string; // cleaned for display
  front?: string; // front cover image, best quality
  small?: string; // light front cover for small or distant renderings
  spine?: string; // spine image, tall and narrow
  cloth: string; // binding colour
  depth: number; // spine thickness in px when the book stands about 190px tall
  heightScale: number; // height relative to an average book, about 0.85 to 1.1
  pages?: number;
  edition?: string; // link to the print edition
  editionLabel: string;
  custom: boolean; // a jacket made for this library, not the publisher's
  jacket?: Jacket;
};
// Everything known about how one book looks. Covers and spines are local
// files under /jackets, /covers, /shelf-covers and /bindings.
export function bookArt(book: ShelfBook): BookArt {
  const jacket = jacketFor(book);
  const isbn = /^\d{13}$/.test(book.cover) ? book.cover : "";
  return {
    title: displayTitle(book.title),
    front: jacket?.file ?? (isbn ? "/covers/" + isbn + ".jpg" : undefined),
    small: jacket?.small,
    spine: jacket?.spine,
    cloth:
      jacket?.cloth ??
      cloths[
        [...book.id].reduce((n, c) => n + c.charCodeAt(0), 0) % cloths.length
      ],
    depth: jacket?.pages
      ? Math.min(62, Math.max(10, Math.round(5 + jacket.pages * 0.057)))
      : (jacket?.depth ?? 25),
    heightScale: jacket?.heightScale ?? 1,
    pages: jacket?.pages,
    edition: jacket?.pages ? jacket.edition : undefined,
    editionLabel: jacket?.editionLabel ?? "print edition",
    custom: Boolean(jacket?.custom),
    jacket,
  };
}

// The published synopsis for one book. Pass owner=true with a private book id.
export function useNote(id: string | undefined, owner = false) {
  const [note, setNote] = useState<Note | null | undefined>(() =>
    id && !owner ? cachedNote(id) : undefined,
  );
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFailed(false);
    if (!id) {
      setNote(undefined);
      return;
    }
    const ready = owner ? undefined : cachedNote(id);
    setNote(ready);
    if (ready !== undefined) return;
    let active = true;
    (owner ? readOwnerNote(id) : readNote(id))
      .then((data) => {
        if (active) setNote(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [id, owner, attempt]);
  return {
    note, // undefined while loading, null when the book has none
    state: failed
      ? ("error" as const)
      : note === undefined
        ? ("loading" as const)
        : ("ok" as const),
    retry: () => setAttempt((n) => n + 1),
  };
}

// "/" calls search(). Typing the owner word calls enter().
export function useShelfKeys(opts: {
  paused?: boolean;
  search?: () => void;
  enter: () => void;
}) {
  const { paused = false } = opts;
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
      if (e.key === "/" && opts.search) {
        e.preventDefault();
        opts.search();
        reset();
        return;
      }
      if (e.key === "Shift") return;
      const letter = e.key.toLowerCase();
      matched =
        letter === word[matched] ? matched + 1 : Number(letter === word[0]);
      if (matched === word.length) {
        reset();
        opts.enter();
      }
    }
    window.addEventListener("keydown", key);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", reset);
    };
    // Callers pass fresh callbacks each render; only pausing matters.
  }, [paused]);
}

export { displayTitle, jacketFor };
export { warmNote } from "./bookNote";
