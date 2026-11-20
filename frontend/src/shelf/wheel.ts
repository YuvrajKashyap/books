export function scrollShelfWheel(
  shelf: Pick<HTMLElement, "clientWidth" | "scrollWidth" | "scrollLeft">,
  event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode" | "ctrlKey" | "shiftKey" | "cancelable" | "preventDefault">,
) {
  // Preserve native horizontal gestures, shift-wheel, and trackpad pinch zoom.
  if (!event.cancelable || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? shelf.clientWidth : 1;
  const end = shelf.scrollWidth - shelf.clientWidth;
  const target = Math.max(0, Math.min(end, shelf.scrollLeft + event.deltaY * unit));
  if (Math.abs(target - shelf.scrollLeft) < 0.5) return;
  event.preventDefault();
  shelf.scrollLeft = target;
}
