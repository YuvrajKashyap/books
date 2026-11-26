// The book in the hand: a full CSS 3D hardcover that can be turned by drag or
// arrow keys, coasts, settles, and opens to its half-title page.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BookArt } from "../../../../shared/catalogue";
import { aspectOf, clamp, rememberAspect } from "./layout";

export type Pose = { yaw: number; pitch: number }; // degrees

const REST: Pose = { yaw: -22, pitch: -7 };

type Props = {
  id: string;
  art: BookArt;
  author: string;
  base: number; // height in px of an average book
  from: Pose; // how the book was standing when it was picked
  leaving: Pose | null; // set while it falls back to the shelf
  still: boolean; // reduced motion
};

export function Jacket({ id, art, author, base, from, leaving, still }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [aspect, setAspect] = useState(() => aspectOf(id));
  const s = useRef({
    yaw: REST.yaw,
    pitch: REST.pitch,
    vy: 0,
    vp: 0,
    goal: REST.yaw as number | null,
    drag: false,
    moved: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    open: false,
    leave: null as Pose | null,
    raf: 0,
    last: 0,
    frames: 0,
  });
  const wakeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const st = s.current;
    const body = bodyRef.current;
    if (!body) return;
    const write = () => {
      body.style.transform = `rotateX(${st.pitch.toFixed(2)}deg) rotateY(${st.yaw.toFixed(2)}deg)`;
      const rad = (st.yaw * Math.PI) / 180;
      body.style.setProperty(
        "--sheen",
        (50 + Math.sin(rad) * 70).toFixed(1) + "%",
      );
      body.style.setProperty("--turn", Math.abs(Math.sin(rad)).toFixed(3));
    };
    const step = (now: number) => {
      const dt = Math.min(0.04, (now - st.last) / 1000) || 0.016;
      st.last = now;
      st.frames++;
      let resting = false;
      if (!st.drag) {
        const period = st.open ? 360 : 180;
        const goal = st.leave
          ? st.leave.yaw + Math.round((st.yaw - st.leave.yaw) / 360) * 360
          : (st.goal ??
            REST.yaw + Math.round((st.yaw - REST.yaw) / period) * period);
        const calm =
          st.goal !== null || st.leave
            ? 1
            : 1 - Math.min(1, Math.abs(st.vy) / 240);
        st.vy += ((goal - st.yaw) * 24 * calm - st.vy * (2 + 5.4 * calm)) * dt;
        st.yaw += st.vy * dt;
        const pitchGoal = st.leave ? st.leave.pitch : REST.pitch;
        st.vp += ((pitchGoal - st.pitch) * 46 - st.vp * 11) * dt;
        st.pitch += st.vp * dt;
        resting =
          Math.abs(goal - st.yaw) < 0.05 &&
          Math.abs(st.vy) < 0.5 &&
          Math.abs(pitchGoal - st.pitch) < 0.05 &&
          Math.abs(st.vp) < 0.5;
      }
      write();
      st.raf = resting ? 0 : requestAnimationFrame(step);
    };
    wakeRef.current = () => {
      if (st.raf) return;
      st.last = performance.now();
      st.raf = requestAnimationFrame(step);
    };
    write();
    return () => {
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    };
  }, []);

  // A new book arrives standing as it stood on the shelf, then tumbles to rest.
  useEffect(() => {
    const st = s.current;
    setOpen(false);
    st.open = false;
    setAspect(aspectOf(id));
    if (still) {
      st.yaw = REST.yaw;
      st.pitch = REST.pitch;
      st.vy = st.vp = 0;
    } else {
      st.yaw = from.yaw + 360;
      st.pitch = from.pitch;
      st.vy = -120;
      st.vp = 0;
    }
    st.goal = REST.yaw;
    st.frames = 0;
    wakeRef.current();
    // If frames are not being produced, do not leave the book mid-tumble.
    const safe = window.setTimeout(() => {
      if (st.frames > 20 || st.drag || st.leave) return;
      st.yaw = REST.yaw;
      st.pitch = REST.pitch;
      st.vy = st.vp = 0;
      const body = bodyRef.current;
      if (body)
        body.style.transform = `rotateX(${REST.pitch}deg) rotateY(${REST.yaw}deg)`;
    }, 1500);
    return () => window.clearTimeout(safe);
    // Only a change of book restarts the tumble.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const st = s.current;
    st.leave = leaving;
    if (leaving) {
      setOpen(false);
      st.open = false;
      wakeRef.current();
    }
  }, [leaving]);

  const toggle = () => {
    const st = s.current;
    st.open = !st.open;
    st.goal = null;
    setOpen(st.open);
    wakeRef.current();
  };

  const h = Math.round(base * art.heightScale);
  const w = Math.round(h * aspect);
  const d = Math.max(8, Math.round((art.depth * base) / 190));

  return (
    <div
      className="gj"
      style={
        {
          "--w": w + "px",
          "--h": h + "px",
          "--d": d + "px",
          "--cloth": art.cloth,
        } as CSSProperties
      }
    >
      <div
        className="gj-book"
        role="button"
        tabIndex={0}
        aria-pressed={open}
        aria-label={`${art.title}. Drag or use the arrow keys to turn the book. Press Enter to ${open ? "close" : "open"} the cover.`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const st = s.current;
          st.drag = true;
          st.moved = 0;
          st.goal = null;
          st.lastX = e.clientX;
          st.lastY = e.clientY;
          st.lastT = performance.now();
          st.vy = st.vp = 0;
          e.currentTarget.setPointerCapture(e.pointerId);
          wakeRef.current();
        }}
        onPointerMove={(e) => {
          const st = s.current;
          if (!st.drag) return;
          const now = performance.now();
          const dx = e.clientX - st.lastX;
          const dy = e.clientY - st.lastY;
          const dt = Math.max(0.004, (now - st.lastT) / 1000);
          st.moved += Math.abs(dx) + Math.abs(dy);
          st.yaw += dx * 0.46;
          st.pitch = clamp(st.pitch - dy * 0.3, -72, 72);
          st.vy = st.vy * 0.6 + ((dx * 0.46) / dt) * 0.4;
          st.lastX = e.clientX;
          st.lastY = e.clientY;
          st.lastT = now;
        }}
        onPointerUp={(e) => {
          const st = s.current;
          if (!st.drag) return;
          st.drag = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          if (performance.now() - st.lastT > 90) st.vy = 0;
          st.vy = clamp(st.vy, -1400, 1400);
          if (st.moved < 7) toggle();
          wakeRef.current();
        }}
        onPointerCancel={() => {
          s.current.drag = false;
          wakeRef.current();
        }}
        onKeyDown={(e) => {
          const st = s.current;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            st.goal = null;
            st.vy += e.key === "ArrowLeft" ? -190 : 190;
            wakeRef.current();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            st.vp += e.key === "ArrowUp" ? 260 : -260;
            wakeRef.current();
          }
        }}
      >
        <div ref={bodyRef} className={"gj-body" + (open ? " is-open" : "")}>
          <div className="gj-face gj-back" />
          <div className="gj-face gj-spine">
            <span>{art.title}</span>
            {art.spine && (
              <img
                key={art.spine}
                src={art.spine}
                alt=""
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
          </div>
          <div className="gj-face gj-fore" />
          <div className="gj-face gj-head" />
          <div className="gj-face gj-tail" />
          <div className="gj-face gj-page">
            <span className="gj-half">
              <b>{art.title}</b>
              <i />
              <em>{author}</em>
            </span>
          </div>
          <div className="gj-cover">
            <div className="gj-face gj-out">
              <span className="gj-typeset">
                <b>{art.title}</b>
                <em>{author}</em>
              </span>
              {art.front && (
                <img
                  key={art.front}
                  src={art.front}
                  alt=""
                  draggable={false}
                  onLoad={(e) => setAspect(rememberAspect(id, e.currentTarget))}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
            </div>
            <div className="gj-face gj-in" />
          </div>
        </div>
      </div>
    </div>
  );
}
