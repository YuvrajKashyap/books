import { useState } from "react";
import type { ShelfBook } from "../components";
import { displayTitle } from "../../../shared/artwork";
import { BoundVolume } from "./BoundVolume";

export function ShelfPick({
  book,
  faceOut,
  painted = true,
  exposedEnd = false,
  pick,
  reshelve,
}: {
  book: ShelfBook;
  faceOut: boolean;
  painted?: boolean;
  exposedEnd?: boolean;
  pick: () => void;
  reshelve: () => void;
}) {
  const [visited, setVisited] = useState(false);
  const title = displayTitle(book.title);
  return (
    <button
      className="volume-pick"
      title={title + " · " + book.author}
      aria-label={
        (faceOut ? "Open details for " : "Turn to cover of ") +
        title +
        " by " +
        book.author
      }
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setVisited(true);
      }}
      onFocus={() => setVisited(true)}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === "Escape") reshelve();
      }}
    >
      {painted && (
        <BoundVolume
          book={book}
          preview={visited}
          showJacket={faceOut || exposedEnd || visited}
        />
      )}
    </button>
  );
}
