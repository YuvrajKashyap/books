// The four queues and the rotation that draws from three of them.
import { useMemo, useState } from "react";
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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react";
import { focuses, queue, type Book } from "../../shared/owner";
import { bookArt } from "../../shared/catalogue";
import { useTitle } from "../../shared/site";
import { Orbit } from "./Instruments";
import { Face } from "./Volume";
import { cx, shortFocus, useRooms } from "./util";

export function Queues() {
  useTitle("Queues");
  const { library, owner, open } = useRooms();
  const books = library.books;
  const lists = useMemo(() => focuses.map((f) => queue(books, f)), [books]);
  const [tab, setTab] = useState<number>(library.rotation);
  const focus = focuses[tab];
  const rotating = tab < 3;
  const list = lists[tab];
  // The order shown while a move is being saved.
  const [pending, setPending] = useState<string[] | null>(null);
  const byId = useMemo(() => new Map(list.map((b) => [b.id, b])), [list]);
  const ids = pending ?? list.map((b) => b.id);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Explicit: called only from a drop or from an up/down button press.
  async function move(id: string, target: string) {
    if (!target || id === target || owner.saving) return;
    const order = list.map((b) => b.id);
    const from = order.indexOf(id),
      to = order.indexOf(target);
    if (from < 0 || to < 0) return;
    setPending(arrayMove(order, from, to));
    await owner.mutate({ op: "move", id, target });
    setPending(null);
  }
  function drop(e: DragEndEvent) {
    if (e.over) void move(String(e.active.id), String(e.over.id));
  }
  // Pressing a stop only proposes it. Nothing is saved until the owner
  // presses the confirm button beside the instrument.
  const [proposed, setProposed] = useState<number | null>(null);
  const proposal =
    proposed !== null && proposed !== library.rotation ? proposed : null;
  // Explicit: second step, the confirm button.
  async function confirmRotation() {
    if (proposal === null || owner.saving) return;
    if (await owner.mutate({ op: "rotation", rotation: proposal }))
      setProposed(null);
  }

  return (
    <div className="queues">
      <header className="page-head">
        <div>
          <p className="eyebrow">The queues</p>
          <h1 className="display display-2">
            What waits, <em>and in what order.</em>
          </h1>
        </div>
      </header>

      <section className="rot" aria-labelledby="rot-title">
        <div className="rot-words">
          <p className="eyebrow">Rotation</p>
          <h2 id="rot-title" className="title">
            Next from {shortFocus(focuses[library.rotation])}
          </h2>
          <p className="note">
            The rotation runs Identity, then Wealth, then Behavior. Press a stop
            to choose it, then confirm. Nothing changes until you confirm.
          </p>
          {proposal !== null && (
            <div className="rot-ask" role="group" aria-label="Confirm rotation">
              <b>Set next category to {focuses[proposal]}?</b>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-brass"
                  disabled={owner.saving}
                  onClick={() => void confirmRotation()}
                >
                  Set next to {shortFocus(focuses[proposal])}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setProposed(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <Orbit
          next={library.rotation}
          selected={proposal ?? library.rotation}
          onSelect={(i) => setProposed(i === library.rotation ? null : i)}
          counts={lists.slice(0, 3).map((l) => l.length)}
          disabled={owner.saving}
          verb="Choose"
        />
      </section>

      <div className="tabs" role="tablist" aria-label="Queues">
        {focuses.map((f, i) => (
          <button
            key={f}
            type="button"
            role="tab"
            id={"queue-tab-" + i}
            aria-selected={i === tab}
            aria-controls="queue-panel"
            tabIndex={i === tab ? 0 : -1}
            className={cx(
              "tab",
              i === tab && "is-on",
              i === library.rotation && "is-next",
            )}
            onClick={() => {
              setTab(i);
              setPending(null);
            }}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const to =
                (i + (e.key === "ArrowRight" ? 1 : focuses.length - 1)) %
                focuses.length;
              setTab(to);
              setPending(null);
              document.getElementById("queue-tab-" + to)?.focus();
            }}
          >
            <span>{f}</span>
            <b>{lists[i].length}</b>
            {i === library.rotation && <small>next</small>}
          </button>
        ))}
      </div>

      <section
        id="queue-panel"
        role="tabpanel"
        aria-labelledby={"queue-tab-" + tab}
        className="queue"
        key={tab}
      >
        <p className="note queue-note">
          {rotating
            ? "Stop " +
              (tab + 1) +
              " of 3 in the rotation." +
              (tab === library.rotation ? " This is the next category." : "")
            : "Misc. sits outside the rotation. These books are never picked automatically."}{" "}
          {list.length > 1 &&
            "Drag by the handle, or use the arrows, to reorder."}
        </p>
        {!list.length ? (
          <div className="empty empty-big">
            <h2 className="title">Nothing is waiting here.</h2>
            <p>No book with status To Read is filed under {focus}.</p>
            <button
              type="button"
              className="btn btn-brass"
              onClick={() => open("new")}
            >
              <Plus size={16} aria-hidden="true" />
              Add a book
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={drop}
          >
            <SortableContext
              items={ids}
              strategy={verticalListSortingStrategy}
              disabled={owner.saving}
            >
              <ol className={cx("queue-list", owner.saving && "is-saving")}>
                {ids.map((id, i) => {
                  const b = byId.get(id);
                  return b ? (
                    <QueueRow
                      key={id}
                      book={b}
                      n={i + 1}
                      head={i === 0}
                      headLabel={rotating ? "Next up" : "First"}
                      busy={owner.saving}
                      onOpen={() => open(id)}
                      onUp={i > 0 ? () => void move(id, ids[i - 1]) : undefined}
                      onDown={
                        i < ids.length - 1
                          ? () => void move(id, ids[i + 1])
                          : undefined
                      }
                    />
                  ) : null;
                })}
              </ol>
            </SortableContext>
          </DndContext>
        )}
      </section>
    </div>
  );
}

function QueueRow({
  book,
  n,
  head,
  headLabel,
  busy,
  onOpen,
  onUp,
  onDown,
}: {
  book: Book;
  n: number;
  head: boolean;
  headLabel: string;
  busy: boolean;
  onOpen: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: book.id });
  const title = bookArt(book).title;
  return (
    <li
      ref={setNodeRef}
      className={cx("qrow", head && "is-head", isDragging && "is-dragging")}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        type="button"
        className="qrow-grip"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={"Reorder " + title + ", position " + n}
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>
      <span className="qrow-n" aria-hidden="true">
        {String(n).padStart(2, "0")}
      </span>
      <button type="button" className="qrow-open" onClick={onOpen}>
        <Face book={book} size={head ? 104 : 72} />
        <span className="qrow-words">
          {head && <small className="pill pill-lit">{headLabel}</small>}
          <b>{title}</b>
          {book.author && <span>{book.author}</span>}
          {book.format && <small>{book.format}</small>}
        </span>
      </button>
      <span className="qrow-moves">
        <button
          type="button"
          className="btn btn-round btn-tiny"
          disabled={!onUp || busy}
          onClick={onUp}
          aria-label={"Move " + title + " up"}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-round btn-tiny"
          disabled={!onDown || busy}
          onClick={onDown}
          aria-label={"Move " + title + " down"}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}
