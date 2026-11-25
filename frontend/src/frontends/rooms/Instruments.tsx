// Brass instruments: the progress dial, the three-stop rotation and the
// hanging filament. All drawn in SVG.
import { useEffect, useState } from "react";
import { focuses } from "../../shared/owner";
import { cx, shortFocus } from "./util";

const polar = (cx0: number, cy0: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [cx0 + r * Math.cos(a), cy0 + r * Math.sin(a)] as const;
};

// A 270 degree dial reading 0 to 100. Null reads as not recorded.
export function ProgressDial({
  value,
  reduced,
}: {
  value: number | null;
  reduced: boolean;
}) {
  const [shown, setShown] = useState(reduced ? (value ?? 0) : 0);
  useEffect(() => {
    if (reduced) {
      setShown(value ?? 0);
      return;
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(value ?? 0)),
    );
    return () => cancelAnimationFrame(id);
  }, [value, reduced]);

  const start = 135,
    sweep = 270,
    r = 82;
  const [x0, y0] = polar(100, 100, r, start);
  const [x1, y1] = polar(100, 100, r, start + sweep);
  const arc = `M ${x0} ${y0} A ${r} ${r} 0 1 1 ${x1} ${y1}`;
  const ticks = Array.from({ length: 51 }, (_, i) => {
    const deg = start + (i / 50) * sweep;
    const major = i % 5 === 0;
    const [ax, ay] = polar(100, 100, major ? 66 : 70, deg);
    const [bx, by] = polar(100, 100, 74, deg);
    return (
      <line
        key={i}
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        className={cx(
          "dial-tick",
          major && "is-major",
          i * 2 <= shown && value !== null && "is-lit",
        )}
      />
    );
  });
  const marks = [0, 25, 50, 75, 100].map((n) => {
    const [tx, ty] = polar(100, 100, 55, start + (n / 100) * sweep);
    return (
      <text key={n} x={tx} y={ty + 3} className="dial-mark">
        {n}
      </text>
    );
  });
  return (
    <div
      className={cx("dial", value === null && "is-empty")}
      role="img"
      aria-label={
        value === null
          ? "Progress not recorded"
          : "Progress " + value + " percent"
      }
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path d={arc} className="dial-track" />
        {value !== null && (
          <path
            d={arc}
            className="dial-value"
            pathLength={100}
            strokeDasharray={`${shown} 100`}
          />
        )}
        {ticks}
        {marks}
        {value !== null && (
          <g
            className="dial-hand"
            style={{ transform: `rotate(${start + (shown / 100) * sweep}deg)` }}
          >
            <line x1="160" y1="100" x2="176" y2="100" />
            <circle cx="182" cy="100" r="4.5" />
          </g>
        )}
        <circle cx="100" cy="100" r="3" className="dial-pin" />
      </svg>
      <div className="dial-read">
        {value === null ? (
          <>
            <b>--</b>
            <span>not recorded</span>
          </>
        ) : (
          <>
            <b>
              {value}
              <i>%</i>
            </b>
            <span>read</span>
          </>
        )}
      </div>
    </div>
  );
}

const stops = [0, 1, 2].map((i) => {
  const [x, y] = polar(160, 104, 1, -90 + i * 120);
  return { x: 160 + (x - 160) * 122, y: 104 + (y - 104) * 62 };
});

// Identity -> Wealth -> Behavior as three stops on one orbit. `next` is the
// category the library will pick from; `selected` is the stop being looked
// at. Selecting never changes anything by itself: the caller decides.
export function Orbit({
  next,
  selected,
  onSelect,
  counts,
  disabled,
  verb,
}: {
  next: number;
  selected: number;
  onSelect: (index: number) => void;
  counts: number[];
  disabled?: boolean;
  // What pressing a stop does, for the label: "Look at" or "Set next to".
  verb: string;
}) {
  return (
    <div className="orbit">
      <svg viewBox="0 0 320 208" aria-hidden="true">
        <ellipse cx="160" cy="104" rx="122" ry="62" className="orbit-path" />
        <ellipse cx="160" cy="104" rx="150" ry="84" className="orbit-far" />
        <ellipse cx="160" cy="104" rx="60" ry="26" className="orbit-far" />
        {[-30, 90, 210].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const x = 160 + 122 * Math.cos(a),
            y = 104 + 62 * Math.sin(a);
          const turn =
            (Math.atan2(62 * Math.cos(a), -122 * Math.sin(a)) * 180) / Math.PI;
          return (
            <path
              key={deg}
              d="M -5 -4 L 3 0 L -5 4"
              className="orbit-arrow"
              transform={`translate(${x} ${y}) rotate(${turn})`}
            />
          );
        })}
        <circle cx="160" cy="104" r="5" className="orbit-sun" />
        <circle cx="160" cy="104" r="16" className="orbit-halo" />
        <line
          x1="160"
          y1="104"
          x2={stops[next].x}
          y2={stops[next].y}
          className="orbit-ray"
        />
      </svg>
      {focuses.slice(0, 3).map((focus, i) => (
        <button
          key={focus}
          type="button"
          className={cx(
            "orbit-stop",
            i === 0 && "is-top",
            i === next && "is-next",
            i === selected && "is-selected",
          )}
          style={{
            left: (stops[i].x / 320) * 100 + "%",
            top: (stops[i].y / 208) * 100 + "%",
          }}
          disabled={disabled}
          aria-pressed={i === selected}
          aria-label={
            verb +
            " " +
            focus +
            (i === next ? " (next in rotation)" : "") +
            ", " +
            counts[i] +
            " waiting"
          }
          onClick={() => onSelect(i)}
        >
          <i aria-hidden="true" />
          <span>
            <b>{shortFocus(focus)}</b>
            <small>
              {i === next ? "next" : "stop " + (i + 1)} · {counts[i]}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}

// The one light: a bare filament on a cord.
export function Filament({ className }: { className?: string }) {
  return (
    <svg
      className={cx("filament", className)}
      viewBox="0 0 80 150"
      aria-hidden="true"
    >
      <rect x="31" y="0" width="18" height="26" rx="2" className="fil-cap" />
      <path d="M31 8h18M31 14h18M31 20h18" className="fil-thread" />
      <path
        d="M30 26 C 30 44 8 60 8 92 a32 32 0 0 0 64 0 C 72 60 50 44 50 26 Z"
        className="fil-glass"
      />
      <path d="M36 28 L 33 74 M44 28 L 47 74" className="fil-post" />
      <path
        d="M33 74 q 2.5 -16 5 0 t 4.6 0 t 4.6 0 M33 74 q 3 20 7 22 q 4 -2 7 -22"
        className="fil-coil"
      />
      <path d="M18 70 q 4 -18 14 -26" className="fil-glint" />
    </svg>
  );
}
