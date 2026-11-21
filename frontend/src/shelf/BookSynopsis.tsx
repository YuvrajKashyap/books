import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cachedNote, readNote } from "./bookNote";

export function BookSynopsis({ id }: { id: string }) {
  const [note, setNote] = useState(() => cachedNote(id));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (note !== undefined) return;
    let active = true;
    readNote(id).then(data => { if (active) setNote(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [id, note, attempt]);

  if (failed) return <button type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>Retry synopsis</button>;
  if (note === undefined) return <p role="status" className="synopsis-loading">Loading synopsis…</p>;
  if (!note) return null;
  return <div className="book-synopsis">
    <p className="synopsis-lead">{note.brief}</p>
    <details>
      <summary><span className="when-closed">Show more</span><span className="when-open">Show less</span><ChevronDown aria-hidden="true" size={14}/></summary>
      <div className="synopsis-body">
        <p>{note.synopsis}</p>
        <h3>Author background</h3>
        <p>{note.author}</p>
        {note.source && <a href={note.source} target="_blank" rel="noreferrer">Source <span aria-hidden="true">↗</span></a>}
      </div>
    </details>
  </div>;
}
