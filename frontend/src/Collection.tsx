import { useShelfCamera } from "./shelf/useShelfCamera";
import { ContinuousShelf, ShelfSpine } from "./shelf/ContinuousShelf";
import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Search,
  SlidersHorizontal,
  GalleryVerticalEnd,
  Table2,
  LibraryBig,
  BookmarkPlus,
} from "lucide-react";
import { BoundVolume } from "./shelf/BoundVolume";
import { displayTitle } from "./shelf/artwork";
import { Dialog } from "./components";
import {
  columns,
  focuses,
  statuses,
  initialView,
  completed,
  type Book,
  type View,
} from "../../shared/model";
import type { Mutate } from "./Reading";
const phoneLayout = window.matchMedia("(max-width: 700px)");
const onPhoneChange = (notify: () => void) => {
  phoneLayout.addEventListener("change", notify);
  return () => phoneLayout.removeEventListener("change", notify);
};
const labels = {
  author: "Author",
  focus: "Category",
  status: "Status",
  format: "Format",
  progress: "Progress",
  rating: "Rating",
  finished: "Finished",
};
type Props = {
  books: Book[];
  view: View;
  setView: (v: View) => void;
  views: View[];
  open: (id: string) => void;
  mutate: Mutate;
};
const loadTable = () => import("./LibraryTable");
const LibraryTable = lazy(loadTable);
export function Collection({
  books,
  view,
  setView,
  views,
  open,
  mutate,
}: Props) {
  const phone = useSyncExternalStore(onPhoneChange, () => phoneLayout.matches);
  const collection = useRef<HTMLElement>(null);
  useShelfCamera(collection);
  const [options, setOptions] = useState(false),
    [arrange, setArrange] = useState(false),
    [name, setName] = useState(""),
    [limit, setLimit] = useState(36);
  const [turned, setTurned] = useState<string | null>(null);
  function update(v: Partial<View>) {
    if (
      (v.layout && v.layout !== "shelf") ||
      (v.sort && v.sort !== "Shelf order")
    )
      setArrange(false);
    setTurned(null);
    setView({ ...view, ...v });
    setLimit(36);
  }
  const data = useMemo(() => {
    const query = view.query.toLowerCase();
    const filtered = books.filter(
      (b) =>
        (!view.focus || b.focus === view.focus) &&
        (!view.status || b.status === view.status) &&
        (!query ||
          [b.title, b.author, b.notes, b.format]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    );
    if (view.sort === "Author" || view.sort === "Title") {
      const k = view.sort === "Author" ? "author" : "title";
      filtered.sort((a, b) => a[k].localeCompare(b[k]));
    }
    if (view.sort === "Rating")
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return filtered;
  }, [books, view.focus, view.status, view.query, view.sort]);
  const groupNames =
    view.group === "Status"
      ? ["Reading", "Completed", "To Read"]
      : view.group === "Focus"
        ? focuses
        : ["All books"];
  let remaining = limit;
  let hiddenBooks = 0;
  const categoryPicker = (
    <select
      aria-label="Category"
      value={view.focus}
      onChange={(e) => update({ focus: e.target.value as View["focus"] })}
    >
      <option value="">All categories</option>
      {focuses.map((f) => (
        <option key={f}>{f}</option>
      ))}
    </select>
  );
  const move = (id: string, target: string) =>
    mutate({ op: "shelfMove", id, target });
  return (
    <section id="collection" ref={collection}>
      <div className="collection-desk">
        <div className="section-head">
          <p className="desk-count" aria-live="polite">
            {data.length} {data.length === 1 ? "volume" : "volumes"}
          </p>
          <div className="segmented">
            {(
              [
                ["spines", LibraryBig, "Spines"],
                ["shelf", GalleryVerticalEnd, "Covers"],
                ["table", Table2, "Table"],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                aria-pressed={view.layout === key}
                onFocus={
                  key === "table"
                    ? () => {
                        void loadTable().catch(() => {});
                      }
                    : undefined
                }
                onPointerEnter={
                  key === "table"
                    ? (e) => {
                        if (e.pointerType === "mouse")
                          void loadTable().catch(() => {});
                      }
                    : undefined
                }
                onClick={() => update({ layout: key })}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search library"
              placeholder="Find a title, author or note"
              value={view.query}
              onChange={(e) => update({ query: e.target.value })}
            />
          </label>
          {!phone && categoryPicker}
          <button onClick={() => setOptions(true)}>
            <SlidersHorizontal size={15} />
            {phone ? "Filters" : "View options"}
          </button>
        </div>
      </div>
      <div className="pills">
        {(["", ...statuses] as const).map((s) => (
          <button
            key={s}
            aria-pressed={s === view.status}
            onClick={() => update({ status: s })}
          >
            {s || "All books"}
          </button>
        ))}
        {phone && view.focus && (
          <button
            onClick={() => update({ focus: "" })}
            aria-label={"Clear category " + view.focus}
          >
            {view.focus} ×
          </button>
        )}
        {views.length > 0 && (
          <select
            aria-label="Open saved view"
            value=""
            onChange={(e) => {
              const v = views.find((v) => v.name === e.target.value);
              if (v) {
                setView(v);
                setArrange(false);
              }
            }}
          >
            <option value="">Saved views</option>
            {views.map((v) => (
              <option key={v.name}>{v.name}</option>
            ))}
          </select>
        )}
      </div>
      {arrange && (
        <div className="arrange-notice">
          Drag covers or use their arrows. Queue order is preserved.{" "}
          <button onClick={() => setArrange(false)}>Done</button>
        </div>
      )}
      {groupNames.map((g) => {
        let group = data.filter(
          (b) =>
            view.group === "None" ||
            (view.group === "Status" ? b.status : b.focus) === g,
        );
        if (g === "Completed" && view.sort === "Shelf order")
          group = completed(group);
        const continuous =
          (g === "To Read" ||
            view.status === "To Read" ||
            (phone && group.length > 7 && view.layout === "spines")) &&
          view.layout !== "table" &&
          !arrange;
        const visible = continuous ? group : group.slice(0, remaining);
        if (!continuous) remaining -= visible.length;
        hiddenBooks += group.length - visible.length;
        if (!visible.length) return null;
        return (
          <section
            key={g}
            className={
              "shelf-group" +
              (!continuous &&
              view.layout !== "table" &&
              !arrange &&
              visible.length <= (view.layout === "shelf" ? 4 : 14)
                ? " is-brief"
                : "")
            }
          >
            <h2>
              {g}
              <span>{group.length}</span>
            </h2>
            {continuous ? (
              <ContinuousShelf
                key={JSON.stringify([
                  view.query,
                  view.focus,
                  view.sort,
                  view.layout,
                  view.status,
                ])}
                label={g}
                books={group}
                covers={view.layout === "shelf"}
                turned={turned}
                turn={setTurned}
                open={open}
              />
            ) : view.layout === "table" ? (
              <Suspense fallback={<p role="status">Opening table…</p>}>
                <LibraryTable
                  books={visible}
                  view={view}
                  open={open}
                  mutate={mutate}
                  labels={labels}
                />
              </Suspense>
            ) : view.layout === "spines" ? (
              <div className="owner-rack">
                {visible.map((book, index) => (
                  <ShelfSpine
                    key={book.id}
                    book={book}
                    selected={turned === book.id}
                    exposedEnd={index === visible.length - 1}
                    open={open}
                    turn={setTurned}
                  />
                ))}
              </div>
            ) : !arrange ? (
              <div className="owner-rack face-out">
                {visible.map((book, index) => (
                  <ShelfSpine
                    key={book.id}
                    book={book}
                    selected={false}
                    faceOut
                    exposedEnd={index === visible.length - 1}
                    open={open}
                    turn={setTurned}
                  />
                ))}
              </div>
            ) : (
              <div className="covers">
                {visible.map((b, i) => (
                  <div
                    className="card-wrap"
                    key={b.id}
                    draggable={arrange}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", b.id)
                    }
                    onDragOver={(e) => {
                      if (arrange) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/plain");
                      if (
                        arrange &&
                        id !== b.id &&
                        visible.some((x) => x.id === id)
                      )
                        void move(id, b.id);
                    }}
                  >
                    <button className="bookcard" onClick={() => open(b.id)}>
                      <span className="cover-model">
                        <BoundVolume book={b} />
                      </span>
                      <strong>{displayTitle(b.title)}</strong>
                      <small>{b.author || "Author unlisted"}</small>
                    </button>
                    {arrange && (
                      <div className="arrange-controls">
                        <button
                          aria-label={"Move " + b.title + " earlier"}
                          disabled={!i}
                          onClick={() => move(b.id, visible[i - 1].id)}
                        >
                          ←
                        </button>
                        <button
                          aria-label={"Move " + b.title + " later"}
                          disabled={i === visible.length - 1}
                          onClick={() => move(b.id, visible[i + 1].id)}
                        >
                          →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {data.length === 0 && (
        <div className="empty">
          <h3>No matching books</h3>
          <button onClick={() => setView(initialView)}>Clear filters</button>
        </div>
      )}
      {hiddenBooks > 0 && (
        <button className="more" onClick={() => setLimit(limit + 36)}>
          Show more books · {hiddenBooks} remaining
        </button>
      )}
      {options && (
        <Dialog
          title={phone ? "Filters & view" : "View options"}
          onClose={() => setOptions(false)}
        >
          <div className="fields">
            {phone && <label>Category{categoryPicker}</label>}
            <label>
              Group by
              <select
                value={view.group}
                onChange={(e) =>
                  update({ group: e.target.value as View["group"] })
                }
              >
                {["Status", "Focus", "None"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Sort by
              <select
                value={view.sort}
                onChange={(e) =>
                  update({ sort: e.target.value as View["sort"] })
                }
              >
                {["Shelf order", "Title", "Author", "Rating"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={() => {
              setArrange(true);
              update({ layout: "shelf", sort: "Shelf order", group: "None" });
              setOptions(false);
            }}
          >
            Arrange cover shelf
          </button>
          <h3>Table columns</h3>
          <div className="pills">
            {columns.map((k) => (
              <button
                key={k}
                aria-pressed={!view.hidden.includes(k)}
                onClick={() =>
                  update({
                    hidden: view.hidden.includes(k)
                      ? view.hidden.filter((c) => c !== k)
                      : [...view.hidden, k],
                  })
                }
              >
                {labels[k]}
              </button>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate({
                  op: "view",
                  view: { ...view, name: name.trim() },
                })
              ) {
                setOptions(false);
                setName("");
              }
            }}
          >
            <label>
              Save this layout and its filters
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="View name"
              />
            </label>
            <button className="primary">
              <BookmarkPlus size={16} />
              Save view
            </button>
          </form>
          {views.map((v) => (
            <div className="saved" key={v.name}>
              <button
                onClick={() => {
                  setView(v);
                  setOptions(false);
                  setArrange(false);
                }}
              >
                {v.name}
              </button>
              <button
                onClick={() => mutate({ op: "removeView", name: v.name })}
              >
                Remove
              </button>
            </div>
          ))}
        </Dialog>
      )}
    </section>
  );
}
