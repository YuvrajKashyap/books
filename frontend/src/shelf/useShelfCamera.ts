import { useEffect, type RefObject } from "react";

// Align every visible shelf's vanishing point to the same eye position,
// including when the visitor scrolls past the middle of a tall cabinet.
export function useShelfCamera(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const height = window.innerHeight;
      const eye = height * .44;
      const scenes = Array.from(element.querySelectorAll<HTMLElement>(".gallery-volumes,.owner-rack,.covers"));
      const visible = scenes.map(scene => ({ scene, rect: scene.getBoundingClientRect() }))
        .filter(({ rect }) => rect.bottom >= 0 && rect.top <= height)
        .map(({ scene, rect }) => ({
          scene, rect,
          slots: Array.from(scene.querySelectorAll<HTMLElement>(":scope > .volume-slot"), slot => ({
            slot, bounds: slot.getBoundingClientRect(),
          })),
        }));

      for (const { scene, rect, slots } of visible) {
        const center = rect.left + rect.width / 2;
        scene.style.setProperty("--sightline", Math.round(eye - rect.top) + "px");
        // A nearer neighbour hides the receding board on either side of center.
        for (const { slot, bounds } of slots) {
          const distance = Math.abs(bounds.left + bounds.width / 2 - center);
          slot.style.setProperty("--lens-x", Math.round(center - bounds.left) + "px");
          slot.style.setProperty("--lens-y", Math.round(eye - bounds.top) + "px");
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
    const children = new MutationObserver(schedule);
    children.observe(element, {childList:true, subtree:true});
    window.addEventListener("scroll", schedule, { passive:true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      children.disconnect();
      element.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [root]);
}
