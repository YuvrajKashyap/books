// The hanging bulb, its cord and pull-chain, and the layers of darkness and
// dust it lights. All motion comes from the Lamp engine; this only draws.
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";
import { Lamp } from "./lamp";

export function LampView({
  lampRef,
  ready,
  on,
  reduced,
  lite,
  onPull,
}: {
  lampRef: RefObject<Lamp | null>;
  ready: boolean;
  on: boolean;
  reduced: boolean;
  lite: boolean;
  onPull: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const arm = useRef<HTMLDivElement>(null);
  const cord = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const chain = useRef<HTMLDivElement>(null);
  const hole = useRef<HTMLDivElement>(null);
  const full = useRef<HTMLDivElement>(null);
  const haze = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const hold = useRef({ ox: 0, oy: 0, id: -1 });
  const [held, setHeld] = useState(false);
  const [pulled, setPulled] = useState(false);

  useEffect(() => {
    const host = root.current;
    if (
      !host ||
      !arm.current ||
      !cord.current ||
      !anchor.current ||
      !chain.current ||
      !hole.current ||
      !full.current ||
      !haze.current ||
      !canvas.current
    )
      return;
    const lamp = new Lamp(
      {
        root: host,
        arm: arm.current,
        cord: cord.current,
        anchor: anchor.current,
        chain: chain.current,
        hole: hole.current,
        full: full.current,
        haze: haze.current,
        canvas: canvas.current,
      },
      { reduced, lite },
    );
    lampRef.current = lamp;
    return () => {
      lamp.destroy();
      lampRef.current = null;
    };
  }, [lampRef, reduced, lite]);

  useEffect(() => {
    lampRef.current?.setReady(ready);
  }, [lampRef, ready, reduced, lite]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (on) return;
    }
    lampRef.current?.setOn(on);
  }, [lampRef, on]);

  function down(e: PointerEvent<HTMLDivElement>) {
    const lamp = lampRef.current;
    if (!lamp || reduced || (e.pointerType === "mouse" && e.button !== 0))
      return;
    if ((e.target as HTMLElement).closest(".lm-pull")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    hold.current = {
      ox: e.clientX - lamp.bx,
      oy: e.clientY - lamp.by,
      id: e.pointerId,
    };
    lamp.grabAt(lamp.bx, lamp.by);
    setHeld(true);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (hold.current.id !== e.pointerId) return;
    lampRef.current?.dragTo(
      e.clientX - hold.current.ox,
      e.clientY - hold.current.oy,
    );
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (hold.current.id !== e.pointerId) return;
    hold.current.id = -1;
    lampRef.current?.release();
    setHeld(false);
  }
  function pull() {
    setPulled(true);
    window.setTimeout(() => setPulled(false), 280);
    onPull();
  }

  return (
    <div className="lm" ref={root}>
      <div className="lm-dark" aria-hidden="true">
        <div className="lm-hole" ref={hole} />
        <div className="lm-full" ref={full} />
      </div>
      <div className="lm-haze" ref={haze} aria-hidden="true" />
      <canvas className="lm-dust" ref={canvas} aria-hidden="true" />
      <div className="lm-anchor" ref={anchor} aria-hidden="true">
        <div className="lm-halo" />
      </div>
      <div className="lm-arm" ref={arm}>
        <div className="lm-cord" ref={cord} aria-hidden="true" />
        <div
          className={"lm-fixture" + (held ? " is-held" : "")}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <svg className="lm-bulb" viewBox="0 0 120 190" aria-hidden="true">
            <defs>
              <radialGradient id="lamplit-glass" cx="50%" cy="62%" r="52%">
                <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.85" />
                <stop offset="0.35" stopColor="#ffab52" stopOpacity="0.42" />
                <stop offset="1" stopColor="#ff8a2a" stopOpacity="0.05" />
              </radialGradient>
              <linearGradient id="lamplit-brass" x1="0" x2="1">
                <stop offset="0" stopColor="#3b2a12" />
                <stop offset="0.3" stopColor="#c59a4e" />
                <stop offset="0.5" stopColor="#f0d595" />
                <stop offset="0.75" stopColor="#8f6a2e" />
                <stop offset="1" stopColor="#2c1e0c" />
              </linearGradient>
              <filter
                id="lamplit-bloom"
                x="-80%"
                y="-40%"
                width="260%"
                height="180%"
              >
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <g className="lm-socket">
              <rect
                x="50"
                y="0"
                width="20"
                height="7"
                rx="2"
                fill="url(#lamplit-brass)"
              />
              <rect
                x="41"
                y="6"
                width="38"
                height="27"
                rx="4"
                fill="url(#lamplit-brass)"
              />
              <path
                d="M41 13h38M41 19h38M41 25h38"
                stroke="#1c1206"
                strokeOpacity="0.55"
                strokeWidth="1.2"
              />
              <rect
                x="44"
                y="32"
                width="32"
                height="7"
                rx="2"
                fill="url(#lamplit-brass)"
              />
            </g>
            <path
              className="lm-glow"
              d="M46 38C46 62 14 80 14 118c0 34 22 58 46 58s46-24 46-58c0-38-32-56-32-80Z"
              fill="url(#lamplit-glass)"
            />
            <g className="lm-glass" fill="none" strokeLinecap="round">
              <path
                d="M46 38C46 62 14 80 14 118c0 34 22 58 46 58s46-24 46-58c0-38-32-56-32-80"
                stroke="#ffe2b4"
                strokeOpacity="0.5"
                strokeWidth="1.3"
              />
              <path
                d="M60 176v6"
                stroke="#ffe2b4"
                strokeOpacity="0.5"
                strokeWidth="2.4"
              />
              <path
                d="M25 110c-2-18 8-33 20-43"
                stroke="#fff3da"
                strokeOpacity="0.55"
                strokeWidth="2"
              />
              <path
                d="M92 138c-5 13-13 22-24 27"
                stroke="#fff3da"
                strokeOpacity="0.25"
                strokeWidth="1.4"
              />
              <path
                d="M56 39l1 30q3 7 6 0l1-30"
                stroke="#ffe2b4"
                strokeOpacity="0.3"
                strokeWidth="1"
              />
              <path
                d="M57 70l-5 26M63 70l5 26"
                stroke="#d8b06a"
                strokeOpacity="0.7"
                strokeWidth="0.9"
              />
            </g>
            <path
              className="lm-after"
              d="M52 96c-7 56 23 56 16 0"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              filter="url(#lamplit-bloom)"
            />
            <path
              className="lm-bloom"
              d="M52 96c-7 56 23 56 16 0"
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              filter="url(#lamplit-bloom)"
            />
            <path
              className="lm-filament"
              d="M52 96c-7 56 23 56 16 0"
              fill="none"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
          </svg>
          <div className="lm-chain" ref={chain}>
            <div className={"lm-chain-run" + (pulled ? " is-pulled" : "")}>
              <span className="lm-beads" aria-hidden="true" />
              <button
                type="button"
                className="lm-pull"
                aria-pressed={on}
                aria-label={
                  on
                    ? "Pull the chain to turn the lamp off. Arrow keys swing it."
                    : "Pull the chain to turn the lamp on. Arrow keys swing it."
                }
                onClick={pull}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") lampRef.current?.kick(-1.8);
                  if (e.key === "ArrowRight") lampRef.current?.kick(1.8);
                }}
              >
                <span aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
