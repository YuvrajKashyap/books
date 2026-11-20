import { useEffect, type RefObject } from "react";

// Horizontal parallax follows each slot within its row. CSS fixes the vertical eye line.
export function useShelfCamera(root: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const element = root.current;
    if (!element || !enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const scenes = element.querySelectorAll<HTMLElement>(".gallery-volumes,.owner-rack:not(.continuous-shelf)");
      const rows = Array.from(scenes, scene => ({
        rect: scene.getBoundingClientRect(),
        slots: Array.from(scene.querySelectorAll<HTMLElement>(":scope > .volume-slot"), slot => ({
          slot, bounds: slot.getBoundingClientRect(),
        })),
      }));

      for (const { rect, slots } of rows) {
        const center = rect.left + rect.width / 2;
        // A nearer neighbour hides the receding board on either side of center.
        for (const { slot, bounds } of slots) {
          const distance = Math.abs(bounds.left + bounds.width / 2 - center);
          slot.style.setProperty("--lens-x", Math.round(center - bounds.left) + "px");
          slot.style.setProperty("--stack", String(Math.max(1, 2000 - Math.round(distance))));
        }
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === "width") schedule();
    };
    element.addEventListener("transitionend", onTransitionEnd);
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    const children = new MutationObserver(records => {
      if (records.some(({ target }) => target instanceof Element &&
        !target.closest(".continuous-shelf,.volume-slot,.pocket-section"))) schedule();
    });
    children.observe(element, {childList:true, subtree:true});
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      children.disconnect();
      element.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", schedule);
    };
  }, [root, enabled]);
}
