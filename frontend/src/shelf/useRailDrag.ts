import { useEffect, type RefObject } from "react";

// Touch uses native panning and inertia. A mouse can grab the same rail.
export function useRailDrag(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    let pointer: number | null = null;
    let start = 0, left = 0, dragged = false;

    const down = (e: PointerEvent) => {
      dragged = false;
      if (e.pointerType !== "mouse" || e.button !== 0 || rail.scrollWidth <= rail.clientWidth) return;
      pointer = e.pointerId;
      start = e.clientX;
      left = rail.scrollLeft;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer || !e.buttons) return;
      const delta = start - e.clientX;
      if (!dragged && Math.abs(delta) < 6) return;
      if (!dragged) rail.setPointerCapture(e.pointerId);
      dragged = true;
      rail.scrollLeft = left + delta;
    };
    const end = () => { pointer = null; };
    const click = (e: MouseEvent) => {
      if (dragged && e.detail) {
        e.preventDefault();
        e.stopPropagation();
      }
      dragged = false;
    };
    const preventImageDrag = (e: DragEvent) => e.preventDefault();
    rail.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    rail.addEventListener("click", click, true);
    rail.addEventListener("dragstart", preventImageDrag);
    return () => {
      rail.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      rail.removeEventListener("click", click, true);
      rail.removeEventListener("dragstart", preventImageDrag);
    };
  }, [ref]);
}
