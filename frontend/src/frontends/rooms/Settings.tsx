// Settings: what the library holds, taking a copy out, putting a copy back,
// and leaving. Restore replaces everything, so it asks twice.
import { useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, FileUp, LogOut, X } from "lucide-react";
import { readBackup, type Backup } from "../../shared/owner";
import { site } from "../../shared/site";
import { useDialog, useRooms } from "./util";

export function Settings({ onClose }: { onClose: () => void }) {
  const { library, owner } = useRooms();
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{ name: string; backup: Backup } | null>(
    null,
  );
  const [agreed, setAgreed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useDialog(panel, onClose);

  const books = library.books;
  const count = (status: string) =>
    books.filter((b) => b.status === status).length;

  // Reading a file changes nothing. It only stages the backup for the
  // confirmation below.
  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const backup = await readBackup(file);
    setAgreed(false);
    if (!backup) {
      setChosen(null);
      owner.notify("Choose a valid bookshelf JSON backup.");
      return;
    }
    setChosen({ name: file.name, backup });
  }
  // Explicit: the owner chose a file, ticked the box and pressed Replace.
  async function restore() {
    if (!chosen || !agreed || owner.saving) return;
    if (await owner.mutate({ op: "restore", backup: chosen.backup })) {
      setChosen(null);
      setAgreed(false);
    }
  }
  async function leave() {
    setLeaving(true);
    await owner.signOut();
    navigate("/");
  }

  return (
    <div className="sheet-wrap">
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet sheet-narrow"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
      >
        <header className="ed-head">
          <div>
            <p className="eyebrow">Settings</p>
            <h2 className="ed-title">{site.name}</h2>
          </div>
          <button
            type="button"
            className="btn btn-round"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="set">
          <section aria-labelledby="set-sum">
            <h3 id="set-sum">The library</h3>
            <dl className="set-sum">
              <div>
                <dt>Books</dt>
                <dd>{books.length}</dd>
              </div>
              <div>
                <dt>Reading</dt>
                <dd>{count("Reading")}</dd>
              </div>
              <div>
                <dt>To read</dt>
                <dd>{count("To Read")}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{count("Completed")}</dd>
              </div>
              <div>
                <dt>Saved views</dt>
                <dd>{library.views.length}</dd>
              </div>
              <div>
                <dt>Revision</dt>
                <dd>{library.revision}</dd>
              </div>
            </dl>
            <Link to="/shelf" className="link">
              View public shelf
            </Link>
          </section>

          <section aria-labelledby="set-out">
            <h3 id="set-out">Take a copy</h3>
            <p className="note">
              Both are plain JSON files saved to this device. Nothing in the
              library changes.
            </p>
            <div className="set-actions">
              <button
                type="button"
                className="btn"
                onClick={owner.exportLibrary}
              >
                <Download size={16} aria-hidden="true" />
                Export library
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void owner.exportArchive()}
              >
                <Download size={16} aria-hidden="true" />
                Export original Notion archive
              </button>
            </div>
          </section>

          <section aria-labelledby="set-in">
            <h3 id="set-in">Restore a backup</h3>
            <p className="note">
              Restoring replaces every book, saved view and the rotation with
              the contents of a backup file. Export the library first if you may
              want the current state back.
            </p>
            <input
              ref={picker}
              type="file"
              accept="application/json,.json"
              className="sr"
              id="backup-file"
              aria-label="Backup file"
              tabIndex={-1}
              onChange={choose}
            />
            {!chosen ? (
              <button
                type="button"
                className="btn"
                onClick={() => picker.current?.click()}
              >
                <FileUp size={16} aria-hidden="true" />
                Choose a backup file
              </button>
            ) : (
              <div
                className="confirm confirm-dark"
                role="group"
                aria-label="Confirm restore"
              >
                <p>
                  <b>Replace the library with “{chosen.name}”?</b>
                </p>
                <p>
                  The file holds {chosen.backup.books.length}{" "}
                  {chosen.backup.books.length === 1 ? "book" : "books"} and{" "}
                  {chosen.backup.views.length} saved{" "}
                  {chosen.backup.views.length === 1 ? "view" : "views"}. The
                  library now holds {books.length}{" "}
                  {books.length === 1 ? "book" : "books"}, and all of them will
                  be replaced.
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    I understand the current library will be overwritten.
                  </span>
                </label>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={!agreed || owner.saving}
                    onClick={() => void restore()}
                  >
                    Replace library with this backup
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setChosen(null);
                      setAgreed(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="set-leave">
            <h3 id="set-leave">Leave the room</h3>
            <p className="note">Signs out on this device only.</p>
            <button
              type="button"
              className="btn"
              disabled={leaving}
              onClick={() => void leave()}
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
