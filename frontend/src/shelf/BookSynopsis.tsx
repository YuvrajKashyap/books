import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { displayTitle } from "./artwork";
import catalogueUrl from "./synopses.json?url";

type Note = { brief: string; synopsis: string; author: string; source?: string };
type Catalogue = Record<string, Note>;
let catalogue: Catalogue | undefined;
let pending: Promise<Catalogue> | undefined;

function loadCatalogue() {
  pending ??= fetch(catalogueUrl)
    .then(async response => {
      if (!response.ok) throw new Error("Synopsis unavailable");
      catalogue = await response.json() as Catalogue;
      return catalogue;
    })
    .finally(() => { pending = undefined; });
  return pending;
}

export function BookSynopsis({ title, author }: { title: string; author: string }) {
  const [notes, setNotes] = useState(catalogue);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (notes) return;
    let active = true;
    loadCatalogue().then(data => { if (active) setNotes(data); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [notes, attempt]);

  if (failed) return <button type="button" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>Retry synopsis</button>;
  if (!notes) return <p role="status" className="synopsis-loading">Loading synopsis…</p>;
  const note = notes[displayTitle(title) + "|" + author.trim()];
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
