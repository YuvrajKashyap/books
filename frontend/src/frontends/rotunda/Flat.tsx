// Without 3D transforms the room is laid out flat: one long bay per tier that
// scrolls sideways, with the same books, light and brass.
import type { ShelfBook } from "../../shared/catalogue";
import { roman, type Layout, type Tier } from "./room";

export function Flat({
  tiers,
  layout,
  lit,
  matches,
  onOpen,
}: {
  tiers: Tier[];
  layout: Layout;
  lit: number | null;
  matches: Set<string> | null;
  onOpen: (book: ShelfBook) => void;
}) {
  return (
    <div className="flat">
      {tiers.map((tier, t) =>
        lit !== null && lit !== t ? null : (
          <section
            key={tier.focus}
            className="flat-tier"
            aria-label={tier.focus}
          >
            <header>
              <b>{roman[t]}</b>
              <h2>{tier.focus}</h2>
              <span>
                {tier.books.length} {tier.books.length === 1 ? "book" : "books"}
              </span>
            </header>
            <div className={"flat-bay " + layout} tabIndex={-1}>
              {tier.books.map((book, i) => {
                const art = tier.arts[i];
                const src =
                  layout === "spines" ? art.spine : (art.small ?? art.front);
                return (
                  <button
                    key={book.id}
                    type="button"
                    data-book={book.id}
                    className={
                      "flat-book" +
                      (matches && !matches.has(book.id) ? " sunk" : "")
                    }
                    style={{
                      background: art.cloth,
                      height: Math.round(190 * art.heightScale),
                      width:
                        layout === "spines" ? Math.max(14, art.depth) : 124,
                    }}
                    title={`${art.title}, ${book.author}`}
                    aria-label={`${art.title} by ${book.author}. Open.`}
                    onClick={() => onOpen(book)}
                  >
                    {src && (
                      <img src={src} alt="" loading="lazy" decoding="async" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
