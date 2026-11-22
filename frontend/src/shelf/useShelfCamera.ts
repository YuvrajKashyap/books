import { useEffect, type RefObject } from "react";

// Horizontal parallax follows each slot within its row. CSS fixes the vertical eye line.
export function useShelfCamera(
  root: RefObject<HTMLElement | null>,
  enabled = true,
) {
  useEffect(() => {
    const element = root.current;
    if (!element || !enabled) return;
    let frame = 0;
    const selector = ".gallery-volumes,.owner-rack:not(.continuous-shelf)";
    const changed = new Set<HTMLElement>();
    let all = false;
    const update = () => {
      frame = 0;
      const scenes = all
        ? element.querySelectorAll<HTMLElement>(selector)
        : changed;
      const rows = Array.from(scenes, (scene) => ({
        rect: scene.getBoundingClientRect(),
        slots: Array.from(
          scene.querySelectorAll<HTMLElement>(":scope > .volume-slot"),
          (slot) => ({
            slot,
            bounds: slot.getBoundingClientRect(),
          }),
        ),
      }));
      all = false;
      changed.clear();

      for (const { rect, slots } of rows) {
        const center = rect.left + rect.width / 2;
        // A nearer neighbour hides the receding board on either side of center.
        for (const { slot, bounds } of slots) {
          const distance = Math.abs(bounds.left + bounds.width / 2 - center);
          slot.style.setProperty(
            "--lens-x",
            Math.round(center - bounds.left) + "px",
          );
          slot.style.setProperty(
            "--stack",
            String(Math.max(1, 2000 - Math.round(distance))),
          );
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measureAll = () => {
      all = true;
      schedule();
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName !== "width" || !(event.target instanceof Element))
        return;
      const row = event.target.closest<HTMLElement>(selector);
      if (row) {
        changed.add(row);
        schedule();
      }
    };
    element.addEventListener("transitionend", onTransitionEnd);
    const observer = new ResizeObserver(measureAll);
    observer.observe(element);
    const children = new MutationObserver((records) => {
      for (const record of records) {
        if (!(record.target instanceof Element)) continue;
        if (record.target.matches(selector))
          changed.add(record.target as HTMLElement);
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(selector)) changed.add(node);
          else if (
            !node.closest(".volume-slot,.continuous-shelf,.pocket-section")
          ) {
            for (const row of node.querySelectorAll<HTMLElement>(selector))
              changed.add(row);
          }
        }
      }
      if (changed.size) schedule();
    });
    children.observe(element, { childList: true, subtree: true });
    window.addEventListener("resize", measureAll);
    measureAll();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      children.disconnect();
      element.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", measureAll);
    };
  }, [root, enabled]);
}
