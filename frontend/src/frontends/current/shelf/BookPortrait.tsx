import { useRef, useState, type PointerEvent } from "react";
import type { ShelfBook } from "../components";
import { Hardcover } from "./Hardcover";
import { displayTitle } from "../../../shared/artwork";

export function BookPortrait({ book }: { book: ShelfBook }) {
  const [opened, setOpened] = useState(false);
  const angle = useRef(-13);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    start: number;
    dragged: boolean;
  } | null>(null);
  const skipClick = useRef(false);

  function turn(button: HTMLButtonElement, degrees: number) {
    angle.current = degrees;
    button.style.setProperty("--turn", degrees + "deg");
  }

  function move(event: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (!drag.dragged) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(event.clientY - drag.y))
        return;
      drag.dragged = true;
      skipClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    turn(event.currentTarget, drag.start + dx * 0.9);
  }

  return (
    <div className="inspection-stage">
      <button
        type="button"
        className="jacket-object"
        aria-label={`Cover of ${displayTitle(book.title)}`}
        aria-pressed={opened}
        aria-description="Drag or use the left and right arrow keys to turn the book. Activate to open or close it."
        onPointerDown={(e) => {
          if (!e.isPrimary || e.button !== 0) return;
          skipClick.current = false;
          gesture.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            start: angle.current,
            dragged: false,
          };
        }}
        onPointerMove={move}
        onPointerUp={() => {
          gesture.current = null;
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onPointerLeave={() => {
          if (!gesture.current?.dragged) gesture.current = null;
        }}
        onDragStart={(e) => e.preventDefault()}
        onClick={(e) => {
          if (e.detail && skipClick.current) return;
          turn(e.currentTarget, opened ? -13 : -6);
          setOpened(!opened);
        }}
        onKeyDown={(e) => {
          if (
            e.key !== "ArrowLeft" &&
            e.key !== "ArrowRight" &&
            e.key !== "Home"
          )
            return;
          e.preventDefault();
          turn(
            e.currentTarget,
            e.key === "Home"
              ? -13
              : angle.current + (e.key === "ArrowRight" ? 15 : -15),
          );
        }}
        onLoad={(e) => {
          const image = e.target;
          if (image instanceof HTMLImageElement && image.naturalHeight)
            e.currentTarget.style.setProperty(
              "--jacket-ratio",
              String(image.naturalWidth / image.naturalHeight),
            );
        }}
      >
        <span className="inspection-volume">
          <Hardcover book={book} opened={opened} priority />
        </span>
      </button>
    </div>
  );
}
