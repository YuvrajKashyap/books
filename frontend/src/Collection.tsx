import { useShelfCamera } from "./shelf/useShelfCamera";
import { ContinuousShelf, ShelfSpine } from "./shelf/ContinuousShelf";
import { useRef, useState } from "react";
import {
  getCoreRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
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
  bookFields,
  type Book,
  type View,
} from "../../shared/model";
import type { Mutate } from "./Reading";
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
  standalone: boolean;
};
function Table({
  books,
  view,
  open,
  mutate,
}: Pick<Props, "books" | "view" | "open" | "mutate">) {
  const defs: ColumnDef<Book>[] = [
    {
      accessorKey: "title",
      header: "Book",
      cell: (c) => (
        <button className="tabletitle" onClick={() => open(c.row.original.id)}>
          {c.row.original.title}
        </button>
      ),
    },
    ...columns.map((k) => ({
      accessorKey: k,
      header: labels[k],
      cell: ({ row }: { row: { original: Book } }) => {
        const b = row.original,
          value = b[k];
        if (k === "status")
          return (
            <select
              aria-label={"Status for " + b.title}
              value={b.status}
              onChange={(e) =>
                mutate({
                  op: "save",
                  id: b.id,
                  book: { ...bookFields.parse(b), status: e.target.value },
                })
              }
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          );
        return value === null || value === ""
          ? "—"
          : k === "progress"
            ? value + "%"
            : String(value);
      },
    })),
  ];
  const table = useReactTable({
    data: books,
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility: Object.fromEntries(view.hidden.map((k) => [k, false])),
    },
  });
  return (
    <div className="table-wrap">
      <table>
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.original.id}>
              {row.getVisibleCells().map((c) => (
                <td key={c.id}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Collection({
  books,
  view,
  setView,
  views,
  open,
  mutate,
  standalone,
}: Props) {
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
  const data = books.filter(
    (b) =>
      (!view.focus || b.focus === view.focus) &&
      (!view.status || b.status === view.status) &&
      [b.title, b.author, b.notes, b.format]
        .join(" ")
        .toLowerCase()
        .includes(view.query.toLowerCase()),
  );
  if (view.sort === "Author" || view.sort === "Title") {
    const k = view.sort === "Author" ? "author" : "title";
    data.sort((a, b) => a[k].localeCompare(b[k]));
  }
  if (view.sort === "Rating")
    data.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const groupNames =
    view.group === "Status"
      ? ["Reading", "Completed", "To Read"]
      : view.group === "Focus"
        ? focuses
        : ["All books"];
  let remaining = limit;
  let hiddenBooks = 0;
  const move = (id: string, target: string) =>
    mutate({ op: "shelfMove", id, target });
  return (
    <section id="collection" ref={collection}>
      <div className="section-head">
        {standalone ? (
          <p>{data.length} books</p>
        ) : (
          <h2>
            Your collection <small>{books.length}</small>
          </h2>
        )}
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
        <select
          aria-label="Category"
          value={view.focus}
          onChange={(e) => update({ focus: e.target.value as View["focus"] })}
        >
          <option value="">All categories</option>
          {focuses.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <button onClick={() => setOptions(true)}>
          <SlidersHorizontal size={15} />
          View options
        </button>
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
        const continuous = (g === "To Read" || view.status === "To Read") && view.layout !== "table" && !arrange;
        const visible = continuous ? group : group.slice(0, remaining);
        if (!continuous) remaining -= visible.length;
        hiddenBooks += group.length - visible.length;
        if (!visible.length) return null;
        return (
          <section key={g} className="shelf-group">
            <h3>
              {g}
              <span>{group.length}</span>
            </h3>
            {continuous ? (
              <ContinuousShelf key={JSON.stringify([view.query, view.focus, view.sort, view.layout, view.status])}
                books={group} covers={view.layout === "shelf"} turned={turned} turn={setTurned} open={open}/>
            ) : view.layout === "table" ? (
              <Table books={visible} view={view} open={open} mutate={mutate} />
            ) : view.layout === "spines" ? (
              <div className="owner-rack">
                {visible.map((book, index) => <ShelfSpine key={book.id} book={book} selected={turned === book.id}
                  exposedEnd={index === visible.length - 1} open={open} turn={setTurned}/> )}
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
                      <span className="cover-model"><BoundVolume book={b}/></span>
                      <strong>{displayTitle(b.title)}</strong><small>{b.author || "Author unlisted"}</small>
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
        <Dialog title="View options" onClose={() => setOptions(false)}>
          <div className="fields">
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
