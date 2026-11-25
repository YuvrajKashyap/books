// One collection, three ways to look at it. The view lives in the address.
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDownAZ,
  Bookmark,
  Check,
  Columns3,
  GripVertical,
  Move,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  columns,
  focuses,
  initialView,
  statuses,
  useView,
  type Book,
  type View,
} from "../../shared/owner";
import { bookArt, searchShelf, sortShelf } from "../../shared/catalogue";
import { useTitle } from "../../shared/site";
import { Face, Jacket, Spine } from "./Volume";
import { Stars, cx, longDate, useMedia, useRooms } from "./util";

type Column = (typeof columns)[number];
const layouts: { value: View["layout"]; label: string }[] = [
  { value: "spines", label: "Spines" },
  { value: "shelf", label: "Covers" },
  { value: "table", label: "Table" },
];
const columnNames: Record<Column, string> = {
  author: "Author",
  focus: "Category",
  status: "Status",
  format: "Format",
  progress: "Progress",
  rating: "Rating",
  finished: "Finished",
};

function arrange(books: Book[], view: View) {
  let found = searchShelf(books, view.query);
  if (view.focus) found = found.filter((b) => b.focus === view.focus);
  if (view.status) found = found.filter((b) => b.status === view.status);
  if (view.sort === "Title") found = sortShelf(found, "title");
  if (view.sort === "Author") found = sortShelf(found, "author");
  if (view.sort === "Rating")
    found = sortShelf(found, "title").sort(
      (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
    );
  return found;
}
function groups(books: Book[], group: View["group"]) {
  if (group === "None") return [{ name: "", books }];
  const names: readonly string[] = group === "Status" ? statuses : focuses;
  return names
    .map((name) => ({
      name,
      books: books.filter((b) =>
        group === "Status" ? b.status === name : b.focus === name,
      ),
    }))
    .filter((g) => g.books.length);
}
const sameView = (a: View, b: View) =>
  JSON.stringify({ ...a, name: "" }) === JSON.stringify({ ...b, name: "" });

export function Collection() {
  useTitle("Collection");
  const { library, owner, open } = useRooms();
  const [view, setView] = useView();
  const phone = useMedia("(max-width: 760px)");
  const search = useRef<HTMLInputElement>(null);
  const [arranging, setArranging] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [removing, setRemoving] = useState("");

  const found = useMemo(
    () => arrange(library.books, view),
    [library.books, view.query, view.focus, view.status, view.sort],
  );
  const filtered = Boolean(view.focus || view.status || view.query.trim());
  const canArrange =
    view.sort === "Shelf order" && !filtered && library.books.length > 1;
  const arrangeOn = arranging && canArrange;
  const set = (patch: Partial<View>) => setView({ ...view, ...patch });

  // "/" jumps to search.
  useEffect(() => {
    function key(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        e.key !== "/" ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        t?.closest("input,textarea,select,[role=dialog]")
      )
        return;
      e.preventDefault();
      search.current?.focus();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // Explicit: the owner typed a name and pressed Save.
  async function saveView(e: FormEvent) {
    e.preventDefault();
    const title = name.trim();
    if (!title || owner.saving) return;
    if (
      await owner.mutate({
        op: "view",
        view: { ...view, name: title.slice(0, 80) },
      })
    ) {
      setNaming(false);
      setName("");
    }
  }
  // Explicit: second step after pressing the cross on a saved view.
  async function removeView() {
    if (!removing || owner.saving) return;
    if (await owner.mutate({ op: "removeView", name: removing }))
      setRemoving("");
  }

  return (
    <div className="coll">
      <header className="page-head">
        <div>
          <p className="eyebrow">The collection</p>
          <h1 className="display display-2">
            Every book, <em>in its place.</em>
          </h1>
        </div>
        <p className="count" aria-live="polite">
          <b>{found.length}</b>
          {filtered ? " of " + library.books.length : ""}{" "}
          {found.length === 1 && !filtered ? "book" : "books"}
        </p>
      </header>

      <div className="views" aria-label="Saved views">
        <span className="views-label">
          <Bookmark size={14} aria-hidden="true" />
          Views
        </span>
        <button
          type="button"
          className={cx("chip", sameView(view, initialView) && "is-on")}
          onClick={() => setView(initialView)}
        >
          Default
        </button>
        {library.views.map((v) => (
          <span
            className={cx("chip chip-pair", sameView(view, v) && "is-on")}
            key={v.name}
          >
            <button type="button" onClick={() => setView(v)}>
              {v.name}
            </button>
            <button
              type="button"
              aria-label={"Remove the saved view " + v.name}
              onClick={() => {
                setRemoving(v.name);
                setNaming(false);
              }}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        {!naming && (
          <button
            type="button"
            className="chip chip-ghost"
            onClick={() => {
              setNaming(true);
              setRemoving("");
              setName(view.name === initialView.name ? "" : view.name);
            }}
          >
            <Plus size={13} aria-hidden="true" />
            Save view
          </button>
        )}
        {naming && (
          <form className="views-form" onSubmit={saveView}>
            <label className="sr" htmlFor="view-name">
              Name for this view
            </label>
            <input
              id="view-name"
              className="ink-input"
              value={name}
              maxLength={80}
              placeholder="Name this view"
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setNaming(false)}
            />
            <button
              type="submit"
              className="btn btn-brass btn-small"
              disabled={!name.trim() || owner.saving}
            >
              {library.views.some((v) => v.name === name.trim())
                ? "Replace"
                : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => setNaming(false)}
            >
              Cancel
            </button>
          </form>
        )}
        {removing && (
          <div
            className="views-form"
            role="alertdialog"
            aria-label="Remove saved view"
          >
            <span>
              Remove the saved view “{removing}”? The books are not touched.
            </span>
            <button
              type="button"
              className="btn btn-danger btn-small"
              disabled={owner.saving}
              onClick={removeView}
            >
              Remove view
            </button>
            <button
              type="button"
              className="btn btn-small"
              autoFocus
              onClick={() => setRemoving("")}
            >
              Keep it
            </button>
          </div>
        )}
      </div>

      <div className="bar">
        <label className="bar-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr">Search title or author</span>
          <input
            ref={search}
            type="search"
            value={view.query}
            placeholder="Search title or author"
            maxLength={500}
            onChange={(e) => set({ query: e.target.value })}
          />
          <kbd aria-hidden="true">/</kbd>
        </label>
        <div className="seg" role="group" aria-label="Layout">
          {layouts.map((l) => (
            <button
              key={l.value}
              type="button"
              className={cx(view.layout === l.value && "is-on")}
              aria-pressed={view.layout === l.value}
              onClick={() => set({ layout: l.value })}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Pick
          label="Category"
          value={view.focus}
          options={[
            ["", "All categories"],
            ...focuses.map((f) => [f, f] as [string, string]),
          ]}
          onChange={(v) => set({ focus: v as View["focus"] })}
        />
        <Pick
          label="Status"
          value={view.status}
          options={[
            ["", "Any status"],
            ...statuses.map((s) => [s, s] as [string, string]),
          ]}
          onChange={(v) => set({ status: v as View["status"] })}
        />
        <Pick
          label="Group"
          value={view.group}
          options={[
            ["Status", "By status"],
            ["Focus", "By category"],
            ["None", "No groups"],
          ]}
          onChange={(v) => set({ group: v as View["group"] })}
        />
        <Pick
          label="Sort"
          value={view.sort}
          options={["Shelf order", "Title", "Author", "Rating"].map(
            (s) => [s, s] as [string, string],
          )}
          onChange={(v) => set({ sort: v as View["sort"] })}
        />
        {view.layout === "table" && (
          <div className="pop-wrap">
            <button
              type="button"
              className={cx("btn", chooser && "is-on")}
              aria-expanded={chooser}
              aria-controls="column-chooser"
              onClick={() => setChooser(!chooser)}
            >
              <Columns3 size={16} aria-hidden="true" />
              Columns
            </button>
            {chooser && (
              <fieldset
                id="column-chooser"
                className="pop"
                onKeyDown={(e) => e.key === "Escape" && setChooser(false)}
              >
                <legend>Columns shown</legend>
                {columns.map((c) => (
                  <label key={c} className="check">
                    <input
                      type="checkbox"
                      checked={!view.hidden.includes(c)}
                      onChange={(e) =>
                        set({
                          hidden: e.target.checked
                            ? view.hidden.filter((h) => h !== c)
                            : columns.filter(
                                (k) => k === c || view.hidden.includes(k),
                              ),
                        })
                      }
                    />
                    <span>{columnNames[c]}</span>
                  </label>
                ))}
              </fieldset>
            )}
          </div>
        )}
        {canArrange && (
          <button
            type="button"
            className={cx("btn", arrangeOn && "is-on")}
            aria-pressed={arrangeOn}
            onClick={() => setArranging(!arrangeOn)}
          >
            {arrangeOn ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Move size={16} aria-hidden="true" />
            )}
            {arrangeOn ? "Done arranging" : "Arrange"}
          </button>
        )}
        {filtered && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => set({ focus: "", status: "", query: "" })}
          >
            <X size={15} aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>

      {!library.books.length ? (
        <div className="empty empty-big">
          <h2 className="title">The shelves are bare.</h2>
          <p>Nothing has been added to this library yet.</p>
          <button
            type="button"
            className="btn btn-brass"
            onClick={() => open("new")}
          >
            <Plus size={16} aria-hidden="true" />
            Add the first book
          </button>
        </div>
      ) : !found.length ? (
        <div className="empty empty-big">
          <h2 className="title">Nothing on the shelves matches.</h2>
          <p>
            No book fits
            {view.query.trim() ? " “" + view.query.trim() + "”" : ""}
            {view.focus ? " in " + view.focus : ""}
            {view.status ? " with status " + view.status : ""}.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => set({ focus: "", status: "", query: "" })}
          >
            Clear filters
          </button>
        </div>
      ) : arrangeOn ? (
        <ArrangeGrid books={library.books} phone={phone} />
      ) : view.layout === "table" ? (
        <Table books={found} view={view} set={set} open={open} />
      ) : (
        groups(found, view.group).map((g) => (
          <section
            className="group"
            key={g.name || "all"}
            aria-label={g.name || "All books"}
          >
            {g.name && (
              <h2 className="group-head">
                <span>{g.name}</span>
                <i aria-hidden="true" />
                <small>{String(g.books.length).padStart(2, "0")}</small>
              </h2>
            )}
            {view.layout === "spines" ? (
              <div
                className="shelf shelf-spines"
                style={{ "--row": (phone ? 168 : 210) + "px" } as CSSProperties}
              >
                {g.books.map((b) => (
                  <span className="slot" key={b.id}>
                    <Spine book={b} size={phone ? 128 : 166} onOpen={open} />
                  </span>
                ))}
              </div>
            ) : (
              <div
                className="shelf shelf-covers"
                style={{ "--row": (phone ? 166 : 226) + "px" } as CSSProperties}
              >
                {g.books.map((b) => (
                  <span className="slot" key={b.id}>
                    <Jacket book={b} size={phone ? 132 : 186} onOpen={open} />
                  </span>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="pick">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

// ----------------------------------------------------------------- Table

function Table({
  books,
  view,
  set,
  open,
}: {
  books: Book[];
  view: View;
  set: (patch: Partial<View>) => void;
  open: (id: string) => void;
}) {
  const shown = columns.filter((c) => !view.hidden.includes(c));
  const sortable: Partial<Record<"title" | Column, View["sort"]>> = {
    title: "Title",
    author: "Author",
    rating: "Rating",
  };
  const head = (key: "title" | Column, text: string) => {
    const sort = sortable[key];
    const on = sort === view.sort;
    return (
      <th
        key={key}
        scope="col"
        className={"col-" + key}
        aria-sort={
          on ? (key === "rating" ? "descending" : "ascending") : undefined
        }
      >
        {sort ? (
          <button
            type="button"
            className={cx("th-sort", on && "is-on")}
            onClick={() => set({ sort: on ? "Shelf order" : sort })}
            title={on ? "Back to shelf order" : "Sort by " + text.toLowerCase()}
          >
            {text}
            <ArrowDownAZ size={13} aria-hidden="true" />
          </button>
        ) : (
          text
        )}
      </th>
    );
  };
  return (
    <div
      className="ledger"
      tabIndex={0}
      role="region"
      aria-label="Collection table"
    >
      <table>
        <thead>
          <tr>
            {head("title", "Title")}
            {shown.map((c) => head(c, columnNames[c]))}
          </tr>
        </thead>
        <tbody>
          {books.map((b) => (
            <tr key={b.id} onClick={() => open(b.id)}>
              <th scope="row" className="col-title">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    open(b.id);
                  }}
                >
                  <Face book={b} size={46} />
                  <span>{bookArt(b).title}</span>
                </button>
              </th>
              {shown.map((c) => (
                <td key={c} className={"col-" + c}>
                  {c === "author" && b.author}
                  {c === "focus" && b.focus}
                  {c === "status" && (
                    <span
                      className={
                        "status status-" +
                        b.status.replace(" ", "").toLowerCase()
                      }
                    >
                      {b.status}
                    </span>
                  )}
                  {c === "format" && b.format}
                  {c === "progress" &&
                    (b.progress === null ? (
                      <span className="dim">not recorded</span>
                    ) : (
                      <span className="meter">
                        <i
                          style={{ transform: `scaleX(${b.progress / 100})` }}
                        />
                        <b>{b.progress}%</b>
                      </span>
                    ))}
                  {c === "rating" &&
                    (b.rating === null ? (
                      <span className="dim">none</span>
                    ) : (
                      <Stars value={b.rating} />
                    ))}
                  {c === "finished" &&
                    (b.finished ? (
                      longDate(b.finished)
                    ) : (
                      <span className="dim">no date</span>
                    ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------- Arrange

function ArrangeGrid({ books, phone }: { books: Book[]; phone: boolean }) {
  const { owner } = useRooms();
  // The order shown while a move is being saved.
  const [pending, setPending] = useState<string[] | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const ids = pending ?? books.map((b) => b.id);

  // Explicit: fires once, when the owner drops a book on a new place.
  async function drop(e: DragEndEvent) {
    const id = String(e.active.id),
      target = e.over ? String(e.over.id) : "";
    if (!target || id === target || owner.saving) return;
    const order = books.map((b) => b.id);
    setPending(arrayMove(order, order.indexOf(id), order.indexOf(target)));
    await owner.mutate({ op: "shelfMove", id, target });
    setPending(null);
  }

  return (
    <div className="arr">
      <p className="note arr-note">
        <GripVertical size={15} aria-hidden="true" />
        Drag a book to its new place. With the keyboard: focus a book, press
        Space, move with the arrow keys, press Space to drop. Each drop saves
        the shelf order.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={drop}
      >
        <SortableContext
          items={ids}
          strategy={rectSortingStrategy}
          disabled={owner.saving}
        >
          <ol className={cx("arr-grid", owner.saving && "is-saving")}>
            {ids.map((id, i) => {
              const b = byId.get(id);
              return b ? (
                <ArrangeTile
                  key={id}
                  book={b}
                  n={i + 1}
                  size={phone ? 104 : 132}
                />
              ) : null;
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function ArrangeTile({
  book,
  n,
  size,
}: {
  book: Book;
  n: number;
  size: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: book.id });
  return (
    <li
      ref={setNodeRef}
      className={cx("arr-tile", isDragging && "is-dragging")}
      style={
        {
          transform: CSS.Transform.toString(transform),
          transition,
          "--tile": size + "px",
        } as CSSProperties
      }
      {...attributes}
      {...listeners}
      aria-label={bookArt(book).title + ", place " + n}
    >
      <Face book={book} size={size} />
      <small>{String(n).padStart(3, "0")}</small>
    </li>
  );
}
