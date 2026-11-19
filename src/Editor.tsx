import { useState } from "react";
import { ExternalLink, Trash2, Check } from "lucide-react";
import { Dialog, Cover } from "./components";
import { freshBook, bookFields, focuses, statuses, type Book } from "./model";
import type { Mutate } from "./Reading";
export function Editor({
  book,
  onClose,
  mutate,
}: {
  book?: Book;
  onClose: () => void;
  mutate: Mutate;
}) {
  const [draft, setDraft] = useState(() =>
      book ? bookFields.parse(book) : freshBook(),
    ),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const latest = book ? JSON.stringify(bookFields.parse(book)) : "";
  const [base, setBase] = useState(latest);
  const stale = latest !== base;
  function set<K extends keyof typeof draft>(key: K, v: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: v }));
  }
  return (
    <Dialog
      drawer
      title={book ? "Book details" : "Add a book"}
      onClose={onClose}
    >
      {book && (
        <div className="editor-heading">
          <Cover book={book} />
          <div>
            <span className="kicker">{book.focus}</span>
            <h2>{book.title}</h2>
            <p>{book.author}</p>
          </div>
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (stale) return;
          const result = bookFields.safeParse(draft);
          if (!result.success) {
            setError(result.error.issues[0].message);
            return;
          }
          setBusy(true);
          const ok = await mutate({
            op: "save",
            id: book?.id,
            book: result.data,
          });
          setBusy(false);
          if (ok) onClose();
          else
            setError("The edit could not be saved. Your draft is still here.");
        }}
      >
        <div className="fields">
          <label className="full">
            Title
            <input
              value={draft.title}
              required
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <label className="full">
            Author
            <input
              value={draft.author}
              onChange={(e) => set("author", e.target.value)}
            />
          </label>
          <label>
            Category
            <select
              value={draft.focus}
              onChange={(e) => set("focus", e.target.value as Book["focus"])}
            >
              {focuses.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(e) => set("status", e.target.value as Book["status"])}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Format
            <input
              value={draft.format}
              onChange={(e) => set("format", e.target.value)}
            />
          </label>
          <label>
            Progress (%)
            <input
              type="number"
              min="0"
              max="100"
              value={draft.progress ?? ""}
              onChange={(e) =>
                set(
                  "progress",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label>
            Finished on
            <input
              type="date"
              value={draft.finished || ""}
              onChange={(e) => set("finished", e.target.value || null)}
            />
          </label>
          <label>
            Rating
            <select
              value={draft.rating ?? ""}
              onChange={(e) =>
                set("rating", e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Unrated</option>
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            Cover ISBN (optional)
            <input
              inputMode="numeric"
              pattern="[0-9]{13}"
              placeholder="13-digit ISBN"
              value={draft.cover}
              onChange={(e) =>
                set("cover", e.target.value.replace(/[- ]/g, ""))
              }
            />
          </label>
          <label className="full">
            Reading notes
            <textarea
              value={draft.notes}
              rows={5}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
        </div>
        {book && (
          <details>
            <summary>History and source</summary>
            {book.history.length ? (
              book.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <p key={i}>
                    {h.at.slice(0, 10)} · {h.event}
                  </p>
                ))
            ) : (
              <p>No edits recorded since the import.</p>
            )}
            {book.source && (
              <a target="_blank" rel="noreferrer" href={book.source}>
                Original Notion page <ExternalLink size={13} />
              </a>
            )}
          </details>
        )}
        {stale && book && (
          <div className="confirm">
            <p>
              This book changed in another session. Copy any draft notes you
              want to keep, then load the current version.
            </p>
            <button
              type="button"
              onClick={() => {
                setDraft(bookFields.parse(book));
                setBase(latest);
                setError("");
              }}
            >
              Load current version
            </button>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="form-actions">
          {book && (
            <button
              type="button"
              className="icon danger"
              aria-label="Remove book"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy || stale} className="primary">
            <Check size={16} />
            {busy ? "Saving…" : "Save book"}
          </button>
        </div>
      </form>
      {confirm && book && (
        <div className="confirm">
          <p>Remove “{book.title}” from your library?</p>
          <button onClick={() => setConfirm(false)}>Keep book</button>{" "}
          <button
            disabled={busy || stale}
            onClick={async () => {
              setBusy(true);
              if (await mutate({ op: "remove", id: book.id })) onClose();
              setBusy(false);
            }}
          >
            Remove book
          </button>
        </div>
      )}
    </Dialog>
  );
}
