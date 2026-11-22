import { useEffect, useRef, useState, type PointerEvent } from "react";
import { drawLight } from "./lightDrawing";

const instruments = ["Warm the filament", "Split the light", "Bend the starlight"];
const quiet = { instrument: -1, x: 0, y: 0 };
type Gesture = typeof quiet;

export function ScienceStudy() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef<Gesture>(quiet);
  const redraw = useRef<() => void>(() => {});
  const [pinned, setPinned] = useState<Gesture>(quiet);
  const preview = (gesture: Gesture) => {
    target.current = gesture;
    redraw.current();
  };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const levels = [0, 0, 0];
    let x = 0, y = 0, frame = 0, last = 0;
    const paint = (time: number) => {
      frame = 0;
      const aim = target.current;
      const blend = motion.matches ? 1 : 1 - Math.exp(-Math.min(50, time - last || 16) / 70);
      last = time;
      let moving = false;
      const approach = (from: number, to: number) => {
        if (Math.abs(to - from) < 0.006) return to;
        moving = true;
        return from + (to - from) * blend;
      };
      levels.forEach((v, i) => { levels[i] = approach(v, Number(i === aim.instrument)); });
      x = approach(x, aim.x);
      y = approach(y, aim.y);
      drawLight(ctx, el.width, el.height, levels, x, y);
      if (moving && !motion.matches) frame = requestAnimationFrame(paint);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    redraw.current = schedule;
    const resize = () => {
      const bounds = el.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.max(1, Math.round(bounds.width * scale));
      el.height = Math.max(1, Math.round(bounds.height * scale));
      schedule();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    motion.addEventListener("change", schedule);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
      redraw.current = () => {};
    };
  }, []);

  function aim(event: PointerEvent<HTMLButtonElement>, instrument: number) {
    if (event.pointerType === "touch" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    preview({ instrument, x: 2 * (event.clientX - box.left) / box.width - 1,
      y: 2 * (event.clientY - box.top) / box.height - 1 });
  }

  return <div className="light-study" role="group" aria-label="Studies in light">
    <div className="study-art" aria-hidden="true">
      <img className="study-lamp" src="/materials/edison.webp" alt="" width="88" height="88" />
      <canvas ref={canvas} />
    </div>
    {instruments.map((label, instrument) => <button key={label} type="button"
      aria-label={label} aria-pressed={pinned.instrument === instrument}
      onPointerEnter={event => aim(event, instrument)} onPointerMove={event => aim(event, instrument)}
      onPointerLeave={() => preview(pinned)}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) preview({ instrument, x: .3, y: -.4 }); }}
      onBlur={() => preview(pinned)}
      onClick={event => {
        const box = event.currentTarget.getBoundingClientRect();
        const touchX = event.detail ? 2 * (event.clientX - box.left) / box.width - 1 : .4;
        const touchY = event.detail ? 2 * (event.clientY - box.top) / box.height - 1 : -.4;
        const next = pinned.instrument === instrument ? quiet : { instrument, x: touchX, y: touchY };
        setPinned(next);
        preview(next);
      }} />)}
  </div>;
}
