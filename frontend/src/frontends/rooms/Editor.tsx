// The sheet that opens for ?book=<id>. The book itself on the left, the
// paper form on the right. Nothing is written until Save is pressed.
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { ExternalLink, LoaderCircle, Trash2, X } from "lucide-react";
import {
  focuses,
  freshBook,
  statuses,
  type Book,
  type BookFields,
} from "../../shared/owner";
import { bookArt, useNote } from "../../shared/catalogue";
import { useTitle } from "../../shared/site";
import { Volume } from "./Volume";
import {
  cx,
  fieldsOf,
  stamp,
  today,
  useDialog,
  useMedia,
  useRooms,
} from "./util";

const formats = ["Hardcover", "Paperback", "Kindle", "Audiobook", "PDF"];
type Errors = Partial<Record<"title" | "cover" | "source", string>>;

function check(draft: BookFields): Errors {
  const errors: Errors = {};
  if (!draft.title.trim()) errors.title = "A book needs a title.";
  else if (draft.title.trim().length > 1000)
    errors.title = "Keep the title under 1,000 characters.";
  if (!/^(\d{13})?$/.test(draft.cover))
    errors.cover = "An ISBN here is exactly 13 digits, or leave it empty.";
  if (draft.source) {
    let ok = false;
    try {
      ok = new URL(draft.source).protocol === "https:";
    } catch {
      ok = false;
    }
    if (!ok) errors.source = "Use a full https:// address, or leave it empty.";
  }
  return errors;
}

export function Editor({ id, onClose }: { id: string; onClose: () => void }) {
  const { library, reduced } = useRooms();
  const fresh = id === "new";
  const existing = fresh ? undefined : library.books.find((b) => b.id === id);
  // Once the book is saved or removed the sheet is on its way out.
  const [leaving, setLeaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState(false);
  const dirty = useRef(false);

  function requestClose() {
    if (dirty.current && !asking) setAsking(true);
    else if (!dirty.current) onClose();
  }
  useDialog(panel, () => (asking ? setAsking(false) : requestClose()));
  useTitle(
    fresh ? "New book" : existing ? bookArt(existing).title : "Book not found",
  );

  if (leaving) return null;
  return (
    <div className="sheet-wrap">
      <div className="scrim" onClick={requestClose} aria-hidden="true" />
      <div
        className="sheet"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={
          fresh
            ? "New book"
            : existing
              ? "Edit " + bookArt(existing).title
              : "Book not found"
        }
        tabIndex={-1}
      >
        {fresh || existing ? (
          <Form
            book={existing}
            reduced={reduced}
            asking={asking}
            setAsking={setAsking}
            setDirty={(v) => (dirty.current = v)}
            requestClose={requestClose}
            leave={() => {
              setLeaving(true);
              onClose();
            }}
          />
        ) : (
          <div className="sheet-missing">
            <p className="eyebrow">Not on the shelves</p>
            <h2 className="display display-3">
              That book is <em>no longer here.</em>
            </h2>
            <p className="lede">
              The address names a book that is not in the library. It may have
              been removed, or the link may be old.
            </p>
            <button type="button" className="btn btn-brass" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Form({
  book,
  reduced,
  asking,
  setAsking,
  setDirty,
  requestClose,
  leave,
}: {
  book: Book | undefined;
  reduced: boolean;
  asking: boolean;
  setAsking: (v: boolean) => void;
  setDirty: (v: boolean) => void;
  requestClose: () => void;
  leave: () => void;
}) {
  const { owner } = useRooms();
  const phone = useMedia("(max-width: 900px)");
  const uid = useId();
  const initial = useMemo<BookFields>(
    () => (book ? fieldsOf(book) : freshBook()),
    [],
  );
  const [draft, setDraft] = useState<BookFields>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [removing, setRemoving] = useState(false);
  const [typed, setTyped] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  setDirty(dirty);
  const set = <K extends keyof BookFields>(key: K, value: BookFields[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // The browser's own warning if the tab is closed with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Explicit: runs only from the Save button, the form's Enter key or
  // Ctrl/Cmd+S.
  async function save() {
    if (owner.saving || (book && !dirty)) return;
    const found = check(draft);
    setErrors(found);
    const first = (["title", "cover", "source"] as const).find((k) => found[k]);
    if (first) {
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    const fields: BookFields = { ...draft, title: draft.title.trim() };
    const saved = await owner.mutate(
      book
        ? { op: "save", id: book.id, book: fields }
        : { op: "save", book: fields },
    );
    if (saved) leave();
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "s"
      ) {
        e.preventDefault();
        if (!e.repeat) void saveRef.current();
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // Explicit: second step, enabled only after the owner types "remove".
  async function remove() {
    if (!book || owner.saving || typed.trim().toLowerCase() !== "remove")
      return;
    if (await owner.mutate({ op: "remove", id: book.id })) leave();
  }

  const preview = {
    id: book?.id ?? "new",
    title: draft.title,
    author: draft.author,
    focus: draft.focus,
    cover: draft.cover,
  };
  const art = bookArt(preview);
  const events = book ? [...book.history].reverse() : [];
  if (events.length > 1 && events[0].at < events[events.length - 1].at)
    events.reverse();

  return (
    <form
      className="ed"
      ref={form}
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void save();
      }}
    >
      <header className="ed-head">
        <div>
          <p className="eyebrow">{book ? "Editing" : "A new book"}</p>
          <h2 className="ed-title">{art.title || "Untitled"}</h2>
        </div>
        <button
          type="button"
          className="btn btn-round"
          aria-label="Close"
          onClick={requestClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="ed-body">
        <aside className="ed-plate">
          <div className="ed-stage">
            <Volume
              book={preview}
              height={phone ? 250 : 330}
              enter
              reduced={reduced}
            />
          </div>
          <p className="hint" aria-hidden="true">
            drag to turn · tap to open
          </p>
          {book ? (
            <Synopsis
              id={book.id}
              edition={art.edition}
              editionLabel={art.editionLabel}
              pages={art.pages}
            />
          ) : (
            <p className="note">
              The jacket appears as soon as the title and author match a book
              the library has artwork for, or a 13-digit ISBN is given.
            </p>
          )}
        </aside>

        <div className="ed-paper">
          <Row label="Title" id={uid + "t"} error={errors.title} wide>
            <input
              id={uid + "t"}
              name="title"
              className="paper-input paper-input-title"
              value={draft.title}
              maxLength={1000}
              required
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? uid + "t-e" : undefined}
              autoFocus={!book}
              onChange={(e) => set("title", e.target.value)}
            />
          </Row>
          <Row label="Author" id={uid + "a"} wide>
            <input
              id={uid + "a"}
              name="author"
              className="paper-input"
              value={draft.author}
              maxLength={2000}
              onChange={(e) => set("author", e.target.value)}
            />
          </Row>

          <fieldset className="ed-set ed-wide">
            <legend>Status</legend>
            <div className="seg seg-paper">
              {statuses.map((s) => (
                <label key={s} className={cx(draft.status === s && "is-on")}>
                  <input
                    type="radio"
                    name="status"
                    checked={draft.status === s}
                    onChange={() => set("status", s)}
                  />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="ed-set ed-wide">
            <legend>Category</legend>
            <div className="seg seg-paper seg-wrap">
              {focuses.map((f) => (
                <label key={f} className={cx(draft.focus === f && "is-on")}>
                  <input
                    type="radio"
                    name="focus"
                    checked={draft.focus === f}
                    onChange={() => set("focus", f)}
                  />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>

          <Row label="Format" id={uid + "f"}>
            <input
              id={uid + "f"}
              name="format"
              className="paper-input"
              value={draft.format}
              maxLength={500}
              list={uid + "formats"}
              placeholder="Hardcover, Kindle…"
              onChange={(e) => set("format", e.target.value)}
            />
            <datalist id={uid + "formats"}>
              {formats.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Row>

          <Row
            label="Finished"
            id={uid + "d"}
            action={
              draft.finished ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => set("finished", null)}
                >
                  Clear date
                </button>
              ) : (
                <button
                  type="button"
                  className="link"
                  onClick={() => set("finished", today())}
                >
                  Today
                </button>
              )
            }
          >
            <input
              id={uid + "d"}
              name="finished"
              type="date"
              className="paper-input"
              value={draft.finished ?? ""}
              max="9999-12-31"
              onChange={(e) =>
                set(
                  "finished",
                  /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)
                    ? e.target.value
                    : null,
                )
              }
            />
          </Row>

          <Row
            label="Progress"
            id={uid + "p"}
            wide
            action={
              draft.progress !== null ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => set("progress", null)}
                >
                  Clear
                </button>
              ) : (
                <span className="dim">not recorded</span>
              )
            }
          >
            <div className="ed-progress">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                aria-label="Progress, slider"
                className={cx("range", draft.progress === null && "is-empty")}
                style={{ "--v": (draft.progress ?? 0) + "%" } as CSSProperties}
                value={draft.progress ?? 0}
                onChange={(e) => set("progress", Number(e.target.value))}
              />
              <span className="ed-number">
                <input
                  id={uid + "p"}
                  name="progress"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  className="paper-input"
                  placeholder="--"
                  value={draft.progress ?? ""}
                  onChange={(e) => {
                    const n =
                      e.target.value === ""
                        ? null
                        : Math.round(Number(e.target.value));
                    set(
                      "progress",
                      n === null || Number.isNaN(n)
                        ? null
                        : Math.max(0, Math.min(100, n)),
                    );
                  }}
                />
                <i>%</i>
              </span>
            </div>
          </Row>

          <fieldset className="ed-set ed-wide">
            <legend>
              Rating
              {draft.rating !== null ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => set("rating", null)}
                >
                  Clear
                </button>
              ) : (
                <span className="dim">not rated</span>
              )}
            </legend>
            <div className="rate">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={cx(
                    "rate-star",
                    draft.rating !== null && draft.rating >= n
                      ? "is-full"
                      : draft.rating !== null &&
                          draft.rating >= n - 0.5 &&
                          "is-half",
                  )}
                >
                  <button
                    type="button"
                    aria-label={"Rate " + (n === 1 ? 1 : n - 0.5) + " out of 5"}
                    aria-pressed={draft.rating === (n === 1 ? 1 : n - 0.5)}
                    onClick={() => set("rating", n === 1 ? 1 : n - 0.5)}
                    tabIndex={n === 1 ? -1 : 0}
                  />
                  <button
                    type="button"
                    aria-label={"Rate " + n + " out of 5"}
                    aria-pressed={draft.rating === n}
                    onClick={() => set("rating", n)}
                  />
                </span>
              ))}
              <output>
                {draft.rating === null ? "" : draft.rating.toFixed(1)}
              </output>
            </div>
          </fieldset>

          <Row
            label="Cover ISBN"
            id={uid + "c"}
            error={errors.cover}
            hint="13 digits. Leave empty to use the library's own jacket."
          >
            <input
              id={uid + "c"}
              name="cover"
              className="paper-input mono"
              inputMode="numeric"
              value={draft.cover}
              maxLength={17}
              placeholder="9780000000000"
              aria-invalid={Boolean(errors.cover)}
              aria-describedby={errors.cover ? uid + "c-e" : undefined}
              onChange={(e) =>
                set("cover", e.target.value.replace(/[\s-]/g, ""))
              }
            />
          </Row>
          <Row
            label="Source"
            id={uid + "s"}
            error={errors.source}
            hint="An https link, if there is one."
          >
            <input
              id={uid + "s"}
              name="source"
              type="url"
              className="paper-input mono"
              value={draft.source}
              placeholder="https://"
              aria-invalid={Boolean(errors.source)}
              aria-describedby={errors.source ? uid + "s-e" : undefined}
              onChange={(e) => set("source", e.target.value.trim())}
            />
          </Row>

          <Row label="Notes" id={uid + "n"} wide>
            <textarea
              id={uid + "n"}
              name="notes"
              className="paper-input paper-notes"
              value={draft.notes}
              maxLength={200000}
              rows={10}
              placeholder="What stayed with you."
              onChange={(e) => set("notes", e.target.value)}
            />
          </Row>

          {book && (
            <section
              className="ed-wide ed-log"
              aria-label="History of this book"
            >
              <h3>History</h3>
              {events.length ? (
                <ol>
                  {events.map((e, i) => (
                    <li key={i}>
                      <time>{stamp(e.at)}</time>
                      <span>{e.event}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="dim">No events recorded for this book.</p>
              )}
            </section>
          )}

          {book && (
            <section
              className="ed-wide ed-danger"
              aria-label="Remove this book"
            >
              {!removing ? (
                <button
                  type="button"
                  className="btn btn-danger-quiet"
                  onClick={() => {
                    setRemoving(true);
                    setTyped("");
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Remove from library
                </button>
              ) : (
                <div
                  className="confirm"
                  role="group"
                  aria-label="Confirm removal"
                >
                  <p>
                    <b>Remove “{bookArt(book).title}” from the library?</b> Its
                    notes, rating and history go with it. Type <kbd>remove</kbd>{" "}
                    to confirm.
                  </p>
                  <div className="row">
                    <label className="sr" htmlFor={uid + "rm"}>
                      Type remove to confirm
                    </label>
                    <input
                      id={uid + "rm"}
                      className="paper-input mono"
                      value={typed}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="remove"
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => {
                        // Enter here must not submit the form as a save.
                        if (e.key === "Enter") e.preventDefault();
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={
                        typed.trim().toLowerCase() !== "remove" || owner.saving
                      }
                      onClick={() => void remove()}
                    >
                      Remove permanently
                    </button>
                    <button
                      type="button"
                      className="btn btn-on-paper"
                      onClick={() => setRemoving(false)}
                    >
                      Keep the book
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="ed-foot">
        {asking ? (
          <div
            className="ed-ask"
            role="alertdialog"
            aria-label="Unsaved changes"
          >
            <span>You have unsaved changes.</span>
            <button type="button" className="btn btn-danger" onClick={leave}>
              Discard changes
            </button>
            <button
              type="button"
              className="btn"
              autoFocus
              onClick={() => setAsking(false)}
            >
              Keep editing
            </button>
          </div>
        ) : (
          <>
            <span className="ed-state" aria-live="polite">
              {owner.saving
                ? "Saving"
                : dirty
                  ? "Unsaved changes"
                  : book
                    ? "No changes"
                    : "Nothing written yet"}
            </span>
            <button type="button" className="btn" onClick={requestClose}>
              {dirty ? "Cancel" : "Close"}
            </button>
            <button
              type="submit"
              className="btn btn-brass btn-big"
              disabled={owner.saving || (Boolean(book) && !dirty)}
            >
              {owner.saving && (
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
              )}
              {book ? "Save changes" : "Add to library"}
              <kbd aria-hidden="true">Ctrl S</kbd>
            </button>
          </>
        )}
      </footer>
    </form>
  );
}

function Row({
  label,
  id,
  error,
  hint,
  wide,
  action,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  wide?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cx("ed-row", wide && "ed-wide", error && "has-error")}>
      <div className="ed-label">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="ed-error" id={id + "-e"} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="ed-hint">{hint}</p>
      ) : null}
    </div>
  );
}

// The published synopsis: brief first, the rest on request.
function Synopsis({
  id,
  edition,
  editionLabel,
  pages,
}: {
  id: string;
  edition?: string;
  editionLabel: string;
  pages?: number;
}) {
  const { note, state, retry } = useNote(id, true);
  const [more, setMore] = useState(false);
  return (
    <div className="syn">
      <p className="eyebrow">Published synopsis</p>
      {state === "loading" && (
        <p className="dim syn-wait">Fetching the synopsis</p>
      )}
      {state === "error" && (
        <p className="dim">
          The synopsis could not be loaded.{" "}
          <button type="button" className="link" onClick={retry}>
            Try again
          </button>
        </p>
      )}
      {state === "ok" && note === null && (
        <p className="dim">No synopsis is published for this book.</p>
      )}
      {state === "ok" && note && (
        <>
          <p className="syn-brief">{note.brief}</p>
          {more && (
            <div className="syn-more">
              {note.synopsis && <p>{note.synopsis}</p>}
              {note.author && (
                <>
                  <h4>About the author</h4>
                  <p>{note.author}</p>
                </>
              )}
            </div>
          )}
          {(note.synopsis || note.author) && (
            <button
              type="button"
              className="link"
              aria-expanded={more}
              onClick={() => setMore(!more)}
            >
              {more ? "Show less" : "Read the longer synopsis"}
            </button>
          )}
        </>
      )}
      {(pages || edition) && (
        <p className="syn-edition">
          {pages ? pages + " pages" : ""}
          {pages && edition ? " · " : ""}
          {edition && (
            <a href={edition} target="_blank" rel="noreferrer noopener">
              {editionLabel}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          )}
        </p>
      )}
    </div>
  );
}
