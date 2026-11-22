import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cachedNote, readNote, readOwnerNote } from "./bookNote";

export function BookSynopsis({
  id,
  expandedBooks,
  owner = false,
}: {
  id: string;
  expandedBooks?: Set<string>;
  owner?: boolean;
}) {
  const [note, setNote] = useState(() => (owner ? undefined : cachedNote(id)));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (note !== undefined) return;
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
  }, [id, note, attempt, owner]);

  if (failed)
    return (
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      >
        Retry synopsis
      </button>
    );
  if (note === undefined)
    return (
      <p role="status" className="synopsis-loading">
        Loading synopsis…
      </p>
    );
  if (!note) return <p className="synopsis-loading">No synopsis yet.</p>;
  return (
    <div className="book-synopsis">
      <div className="synopsis-summary">
        <h3>Synopsis</h3>
        <p className="synopsis-lead">{note.brief}</p>
      </div>
      <details
        open={expandedBooks?.has(id)}
        onToggle={(event) => {
          if (event.currentTarget.open) expandedBooks?.add(id);
          else expandedBooks?.delete(id);
        }}
      >
        <summary>
          <span className="when-closed">Show more</span>
          <span className="when-open">Show less</span>
          <ChevronDown aria-hidden="true" size={14} />
        </summary>
        <div className="synopsis-body">
          <p>{note.synopsis}</p>
          <h3>Author background</h3>
          <p>{note.author}</p>
          {note.source && (
            <a href={note.source} target="_blank" rel="noreferrer">
              Source <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      </details>
    </div>
  );
}
