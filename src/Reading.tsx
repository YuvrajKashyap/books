import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Repeat2,
  BookOpen,
  LibraryBig,
} from "lucide-react";
import { Cover, FocusIcon, Dialog } from "./components";
import {
  completed,
  nextPick,
  queue,
  focuses,
  type Library,
  type Book,
} from "./model";
export type Mutate = (action: Record<string, unknown>) => Promise<boolean>;
type Open = (id: string) => void;
export function Feature({ library, open }: { library: Library; open: Open }) {
  const reading = library.books.filter((b) => b.status === "Reading"),
    [index, setIndex] = useState(0),
    [compare, setCompare] = useState(false);
  const i = index % Math.max(1, reading.length),
    current = reading[i],
    next = nextPick(library.books, library.rotation);
  return (
    <div className="feature-grid">
      <article className="feature">
        <div className="feature-art" aria-hidden="true">
          <div className="etch" />
          {current ? (
            <Cover key={current.id} book={current} />
          ) : (
            <BookOpen size={70} />
          )}
        </div>
        <div className="feature-text">
          <span className="kicker">
            <span className="light" />
            Currently reading
          </span>
          <h2>{current?.title || "An open shelf"}</h2>
          <p>{current?.author || "Choose a book from your collection."}</p>
          {current && (
            <>
              <span className="meta">
                {current.format || "Reading"}
                {current.progress != null
                  ? " · " + current.progress + "% read"
                  : ""}
              </span>
              <button onClick={() => open(current.id)}>
                Continue reading <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
        {reading.length > 1 && (
          <div className="pager">
            <button
              aria-label="Previous current read"
              onClick={() => setIndex(i + reading.length - 1)}
            >
              <ChevronLeft />
            </button>
            <span>
              {i + 1} / {reading.length}
            </span>
            <button
              aria-label="Next current read"
              onClick={() => setIndex(i + 1)}
            >
              <ChevronRight />
            </button>
          </div>
        )}
      </article>
      <article className="next">
        <div className="next-top">
          <span className="kicker">
            <Repeat2 size={15} />
            Next in rotation
          </span>
          <FocusIcon focus={next?.focus || focuses[0]} />
        </div>
        <div>
          <h2>{next?.title || "Queue complete"}</h2>
          <p>{next?.author}</p>
        </div>
        <div className="next-bottom">
          <span>{next?.focus || "Add an unread book"}</span>
          {next && (
            <button onClick={() => setCompare(true)}>
              Explore pick <ArrowRight size={14} />
            </button>
          )}
        </div>
      </article>
      {compare && next && (
        <Dialog title="Your next read" onClose={() => setCompare(false)}>
          <div className="pick">
            <Cover book={next} />
            <div>
              <span className="kicker">{next.focus}</span>
              <h3>{next.title}</h3>
              <p>{next.author}</p>
              <p>
                First in this queue.{" "}
                {
                  completed(library.books).filter((b) => b.focus === next.focus)
                    .length
                }{" "}
                completed in the same category.
              </p>
              <button
                className="primary"
                onClick={() => {
                  setCompare(false);
                  open(next.id);
                }}
              >
                Open book <ArrowRight size={15} />
              </button>
            </div>
          </div>
          {next.notes && <p className="excerpt">{next.notes}</p>}
          <h3>Other queue leaders</h3>
          {focuses
            .filter((f) => f !== next.focus && f !== "Misc.")
            .map((f) => {
              const b = queue(library.books, f)[0];
              return (
                b && (
                  <button
                    className="alternative"
                    key={f}
                    onClick={() => {
                      setCompare(false);
                      open(b.id);
                    }}
                  >
                    <span>
                      <small>{f}</small>
                      {b.title}
                    </span>
                    <ArrowRight size={15} />
                  </button>
                )
              );
            })}
        </Dialog>
      )}
    </div>
  );
}
function QueueRow({
  b,
  i,
  lane,
  move,
  open,
}: {
  b: Book;
  i: number;
  lane: Book[];
  move: (a: string, b: string) => void;
  open: Open;
}) {
  const s = useSortable({ id: b.id });
  return (
    <div
      className="queue-row"
      ref={s.setNodeRef}
      style={{
        transform: CSS.Transform.toString(s.transform),
        transition: s.transition,
        opacity: s.isDragging ? 0.55 : 1,
      }}
    >
      <button
        className="drag icon"
        aria-label={"Reorder " + b.title}
        {...s.attributes}
        {...s.listeners}
      >
        <GripVertical size={17} />
      </button>
      <span className="rank">{String(i + 1).padStart(2, "0")}</span>
      <button className="queue-title" onClick={() => open(b.id)}>
        <strong>{b.title}</strong>
        <small>{b.author}</small>
      </button>
      <button
        className="icon"
        aria-label={"Move up " + b.title}
        disabled={!i}
        onClick={() => move(b.id, lane[i - 1].id)}
      >
        <ArrowUp size={16} />
      </button>
      <button
        className="icon"
        aria-label={"Move down " + b.title}
        disabled={i === lane.length - 1}
        onClick={() => move(b.id, lane[i + 1].id)}
      >
        <ArrowDown size={16} />
      </button>
    </div>
  );
}
export function Queues({
  library,
  mutate,
  open,
}: {
  library: Library;
  mutate: Mutate;
  open: Open;
}) {
  const [tab, setTab] = useState<number>(library.rotation),
    f = focuses[tab],
    lane = queue(library.books, f);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const move = (id: string, target: string) =>
    void mutate({ op: "move", id, target });
  return (
    <>
      <div className="rotation">
        <Repeat2 size={19} />
        <div>
          <strong>Reading rotation</strong>
          <small>Identity → Wealth → Behavior</small>
        </div>
        <label>
          Next category
          <select
            value={library.rotation}
            onChange={(e) =>
              mutate({ op: "rotation", rotation: Number(e.target.value) })
            }
          >
            {focuses.slice(0, 3).map((f, i) => (
              <option key={f} value={i}>
                {f}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="queue-tabs">
        {focuses.map((f, i) => (
          <button key={f} aria-pressed={tab === i} onClick={() => setTab(i)}>
            <FocusIcon focus={f} />
            {f}
            <small>{queue(library.books, f).length}</small>
          </button>
        ))}
      </div>
      <div className="section-head">
        <h2>{f}</h2>
        <small>{tab === 3 ? "Outside rotation" : "Manual order"}</small>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && over.id !== active.id)
            move(String(active.id), String(over.id));
        }}
      >
        <SortableContext
          items={lane.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {lane.map((b, i) => (
            <QueueRow
              key={b.id}
              b={b}
              i={i}
              lane={lane}
              move={move}
              open={open}
            />
          ))}
        </SortableContext>
      </DndContext>
      {!lane.length && <p className="empty">This queue has no unread books.</p>}
    </>
  );
}
export function Timeline({ books, open }: { books: Book[]; open: Open }) {
  const done = completed(books);
  const years = [
    ...new Set(done.map((b) => b.finished?.slice(0, 4) || "Undated")),
  ];
  return (
    <div className="timeline">
      {years.map((y) => (
        <section key={y}>
          <div className="year">
            <LibraryBig size={18} />
            <h2>{y}</h2>
          </div>
          <div>
            {done
              .filter((b) => (b.finished?.slice(0, 4) || "Undated") === y)
              .map((b) => (
                <button
                  key={b.id}
                  className="timeline-item"
                  onClick={() => open(b.id)}
                >
                  <Cover book={b} />
                  <span>
                    <small>{b.finished || "Completion date unrecorded"}</small>
                    <strong>{b.title}</strong>
                    <span>{b.author}</span>
                    <em>
                      {b.focus}
                      {b.rating ? " · " + b.rating + "/5" : ""}
                    </em>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
          </div>
        </section>
      ))}
      {!done.length && (
        <p className="empty">
          Finished books will appear here in reading order.
        </p>
      )}
    </div>
  );
}
