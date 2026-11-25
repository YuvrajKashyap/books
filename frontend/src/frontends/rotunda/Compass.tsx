// The inlaid floor: a brass compass rose marked in degrees. It turns with the
// room, and search results appear on its ring as ticks you can jump to.
import { memo, type Ref } from "react";
import { focuses } from "../../shared/catalogue";

export type Tick = { id: string; bearing: number; label: string };

const marks = Array.from({ length: 180 }, (_, i) => {
  const deg = i * 2;
  const long = deg % 10 === 0;
  return (
    <line
      key={i}
      y1={-468}
      y2={long ? -446 : -457}
      transform={`rotate(${deg})`}
      opacity={long ? 0.95 : 0.55}
    />
  );
});
const numerals = Array.from({ length: 12 }, (_, i) => {
  const deg = i * 30;
  return (
    <text key={i} className="deg" y={-418} transform={`rotate(${deg})`}>
      {String(deg).padStart(3, "0")}
    </text>
  );
});
function point(deg: number, len: number, half: number, cls: string) {
  return (
    <g key={cls + deg} transform={`rotate(${deg})`}>
      <path className={cls + " lightside"} d={`M0 ${-len}L${half} 0L0 0Z`} />
      <path className={cls + " darkside"} d={`M0 ${-len}L${-half} 0L0 0Z`} />
    </g>
  );
}
const rose = [
  ...[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((d) =>
    point(d, 170, 20, "p3"),
  ),
  ...[45, 135, 225, 315].map((d) => point(d, 250, 34, "p2")),
  ...[0, 90, 180, 270].map((d) => point(d, 345, 46, "p1")),
];
const legend = (focuses.join("  ·  ") + "  ·  ").toUpperCase();

export const Compass = memo(function Compass({
  size,
  ticks,
  current,
  roseRef,
  onTick,
  onNorth,
}: {
  size: number;
  ticks: Tick[];
  current: string | undefined;
  roseRef: Ref<HTMLDivElement>;
  onTick: (id: string) => void;
  onNorth: () => void;
}) {
  const k = size / 1000;
  return (
    <>
      <div className="floor-shell" />
      <div className="floor-persp">
        <div
          className="disc"
          style={{ width: size, height: size, marginLeft: -size / 2 }}
          onDoubleClick={onNorth}
          title="Double-click to return to north"
        >
          <div className="rose" ref={roseRef}>
            <svg viewBox="-500 -500 1000 1000" aria-hidden="true">
              <defs>
                <path
                  id="fx-rotunda-legend"
                  d="M0-378A378 378 0 1 1-0.01-378"
                />
                <radialGradient id="fx-rotunda-floor" r="0.5">
                  <stop offset="0" stopColor="#1c2140" />
                  <stop offset="0.7" stopColor="#11142b" />
                  <stop offset="1" stopColor="#090b1a" />
                </radialGradient>
              </defs>
              <circle r="498" fill="url(#fx-rotunda-floor)" />
              <circle r="492" className="band thick" />
              <circle r="470" className="band" />
              <circle r="440" className="band faint" />
              <circle r="398" className="band" />
              <circle r="362" className="band faint" />
              <circle r="110" className="band" />
              <circle r="64" className="band faint" />
              <g className="marks">{marks}</g>
              {numerals}
              <text className="legend">
                <textPath href="#fx-rotunda-legend" textLength="2360">
                  {legend}
                </textPath>
              </text>
              {rose}
              <circle r="15" className="hub" />
              {["N", "E", "S", "W"].map((c, i) => (
                <text
                  key={c}
                  className="cardinal"
                  y={-292}
                  transform={`rotate(${i * 90})`}
                >
                  {c}
                </text>
              ))}
            </svg>
            {ticks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={"tick" + (t.id === current ? " here" : "")}
                aria-label={`Turn to ${t.label}`}
                title={t.label}
                style={{
                  transform: `rotate(${t.bearing}deg) translateY(${-481 * k}px)`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTick(t.id);
                }}
                onDoubleClick={(e) => e.stopPropagation()}
              />
            ))}
          </div>
          <span className="lubber" aria-hidden="true" />
        </div>
      </div>
    </>
  );
});
