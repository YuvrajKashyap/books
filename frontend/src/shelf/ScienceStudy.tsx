import { useEffect, useRef, useState, type PointerEvent } from "react";
import { drawLight } from "./lightDrawing";

const instruments = ["Warm the filament", "Split the light", "Bend the starlight"];
const quiet = { instrument: -1, x: 0, y: 0 };
type Gesture = typeof quiet;
type TouchSweep = { id: number; startX: number; startY: number; bounds: DOMRect; dragged: boolean };

function touchAim(event: PointerEvent, bounds: DOMRect): Gesture {
  const across = Math.max(0, Math.min(3, (event.clientX - bounds.left) / bounds.width * instruments.length));
  const instrument = Math.min(instruments.length - 1, Math.floor(across));
  return { instrument, x: 2 * (across - instrument) - 1,
    y: Math.max(-1, Math.min(1, 2 * (event.clientY - bounds.top) / bounds.height - 1)) };
}

export function ScienceStudy() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef<Gesture>(quiet);
  const pulseStart = useRef(-Infinity);
  const redraw = useRef<() => void>(() => {});
  const [pinned, setPinned] = useState<Gesture>(quiet);
  const sweep = useRef<TouchSweep | null>(null);
  const skipClick = useRef(false);
  const preview = (gesture: Gesture, strike = gesture.instrument !== target.current.instrument) => {
    if (gesture.instrument >= 0 && strike) {
      pulseStart.current = performance.now();
    }
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
      const blend = motion.matches ? 1 : 1 - Math.exp(-Math.min(50, time - last || 16) / 85);
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
      const pulse = motion.matches ? 1 : Math.max(0, Math.min(1, (time - pulseStart.current) / 1080));
      drawLight(ctx, el.width, el.height, levels, x, y, pulse);
      if ((moving || pulse < 1) && !motion.matches) frame = requestAnimationFrame(paint);
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
    if (event.pointerType === "touch") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (target.current.instrument !== instrument) preview({ instrument, x: 0, y: 0 });
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    preview({ instrument, x: 2 * (event.clientX - box.left) / box.width - 1,
      y: 2 * (event.clientY - box.top) / box.height - 1 });
  }

  function beginTouch(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) return;
    skipClick.current = false;
    if (event.pointerType !== "touch") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    sweep.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, bounds, dragged: false };
    preview(touchAim(event, bounds), true);
  }

  function followTouch(event: PointerEvent<HTMLDivElement>) {
    const current = sweep.current;
    if (!current || current.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= 5) current.dragged = true;
    if (current.dragged) preview(touchAim(event, current.bounds), false);
  }

  function endTouch(event: PointerEvent<HTMLDivElement>) {
    const current = sweep.current;
    if (!current || current.id !== event.pointerId) return;
    sweep.current = null;
    skipClick.current = current.dragged || event.type !== "pointerup";
    preview(pinned, false);
  }

  // Touch keeps its initial button as the implicit capture target. Read the
  // position against the whole study so one finger can steer all three zones.
  return <div className="light-study" role="group" aria-label="Studies in light"
    onPointerDown={beginTouch} onPointerMove={followTouch} onPointerUp={endTouch}
    onPointerCancel={endTouch} onLostPointerCapture={endTouch}>
    <div className="study-art" aria-hidden="true">
      <img className="study-lamp" src="/materials/edison.webp" alt="" width="88" height="88" />
      <canvas ref={canvas} />
    </div>
    {instruments.map((label, instrument) => <button key={label} type="button"
      aria-label={label} aria-pressed={pinned.instrument === instrument}
      onPointerEnter={event => aim(event, instrument)} onPointerMove={event => aim(event, instrument)}
      onPointerLeave={event => { if (event.pointerType !== "touch") preview(pinned); }}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) preview({ instrument, x: .3, y: -.4 }); }}
      onBlur={() => preview(pinned)}
      onClick={event => {
        if (event.detail && skipClick.current) return;
        const box = event.currentTarget.getBoundingClientRect();
        const touchX = event.detail ? 2 * (event.clientX - box.left) / box.width - 1 : .4;
        const touchY = event.detail ? 2 * (event.clientY - box.top) / box.height - 1 : -.4;
        const next = pinned.instrument === instrument ? quiet : { instrument, x: touchX, y: touchY };
        setPinned(next);
        preview(next, true);
      }} />)}
  </div>;
}
