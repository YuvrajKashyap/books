import { useEffect, useRef } from "react";
import "./lamplight.css";

// A reading lamp over the bookcase. The room dims while a pool of warm light
// follows the pointer or the focused book. Only the two lamp elements move,
// by transform, so the hundreds of 3D book faces are never restyled.
export function Lamplight({ ready }: { ready: boolean }) {
  const shade = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dim = shade.current!;
    const warm = glow.current!;
    const cabinet = dim.parentElement!;
    if (!ready) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hovers = matchMedia("(hover: hover) and (pointer: fine)").matches;

    let frame = 0;
    let x = 0,
      y = 0,
      targetX = 0,
      targetY = 0;
    let pointer: { x: number; y: number } | null = null;
    let waking = 0;

    const place = () => {
      const position = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      dim.style.setProperty("--lamp", position);
      warm.style.setProperty("--lamp", position);
    };
    const step = () => {
      frame = 0;
      const ease = still ? 1 : 0.14;
      x += (targetX - x) * ease;
      y += (targetY - y) * ease;
      place();
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.4) schedule();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(step);
    };
    const light = (on: boolean) => {
      dim.classList.toggle("is-lit", on);
      warm.classList.toggle("is-lit", on);
    };
    const aim = (clientX: number, clientY: number, jump = false) => {
      const box = cabinet.getBoundingClientRect();
      targetX = clientX - box.left;
      targetY = clientY - box.top;
      if (jump) {
        x = targetX;
        y = targetY;
      }
      schedule();
    };

    // The first light arrives from the lamp in the heading and settles on the
    // top shelf before the room comes up to its resting level.
    if (!still) {
      const box = cabinet.getBoundingClientRect();
      x = box.width * 0.86;
      y = -180;
      targetX = box.width * 0.5;
      targetY = 150;
      place();
      dim.classList.add("is-waking");
      warm.classList.add("is-waking");
      schedule();
      waking = window.setTimeout(() => {
        dim.classList.remove("is-waking");
        warm.classList.remove("is-waking");
      }, 950);
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const entering = !pointer;
      pointer = { x: event.clientX, y: event.clientY };
      aim(
        event.clientX,
        event.clientY,
        entering && !dim.classList.contains("is-waking"),
      );
      light(true);
    };
    const onLeave = () => {
      pointer = null;
      if (!cabinet.querySelector(".volume-pick:focus-visible")) light(false);
    };
    const onScroll = () => {
      if (pointer) aim(pointer.x, pointer.y);
    };
    const onFocus = (event: FocusEvent) => {
      const book = event.target;
      if (
        !(book instanceof HTMLElement) ||
        !book.matches(".volume-pick:focus-visible")
      )
        return;
      const box = book.getBoundingClientRect();
      aim(box.left + box.width / 2, box.top + box.height * 0.4);
      light(true);
    };
    const onBlur = () => {
      if (!pointer) light(false);
    };

    if (hovers) {
      cabinet.addEventListener("pointermove", onMove);
      cabinet.addEventListener("pointerleave", onLeave);
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    cabinet.addEventListener("focusin", onFocus);
    cabinet.addEventListener("focusout", onBlur);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(waking);
      cabinet.removeEventListener("pointermove", onMove);
      cabinet.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      cabinet.removeEventListener("focusin", onFocus);
      cabinet.removeEventListener("focusout", onBlur);
    };
  }, [ready]);

  return (
    <>
      <div ref={shade} className="lamplight lamp-shade" aria-hidden="true">
        <span />
      </div>
      <div ref={glow} className="lamplight lamp-glow" aria-hidden="true">
        <span />
      </div>
    </>
  );
}
