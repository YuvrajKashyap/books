// Marginal studies of light and spacetime, drawn as working diagrams.
// Every stroke carries pathLength=1 so the sheet can draw them in.
import type { CSSProperties } from "react";

const P = (d: string, k: number, cls = "") => (
  <path
    d={d}
    pathLength={1}
    className={"pl " + cls}
    style={{ "--k": k } as CSSProperties}
  />
);

// A square grid pulled toward a mass.
function bentGrid() {
  const mx = 80;
  const my = 82;
  const bend = (x: number, y: number) => {
    const dx = x - mx;
    const dy = y - my;
    const k = 0.46 * Math.exp(-(dx * dx + dy * dy) / 2300);
    return (x - dx * k).toFixed(1) + " " + (y - dy * k).toFixed(1);
  };
  const lines: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = 12 + i * 17;
    const h: string[] = [];
    const v: string[] = [];
    for (let j = 0; j <= 24; j++) {
      const s = 12 + (j * 136) / 24;
      h.push(bend(s, t + 2));
      v.push(bend(t, s + 2));
    }
    lines.push("M" + h.join(" L"), "M" + v.join(" L"));
  }
  return lines;
}
const grid = bentGrid();
const orbit = "M62 0 A62 36 0 1 1 -62 0 A62 36 0 1 1 62 0";

export function Studies({ still }: { still: boolean }) {
  return (
    <aside
      className="studies"
      aria-label="Marginal studies of light and spacetime"
    >
      <figure className="study s1">
        <svg viewBox="0 0 160 168" aria-hidden="true">
          {P("M80 160 L80 10", 0, "thin")}
          {P("M76.5 17 L80 9 L83.5 17", 1, "thin")}
          {P("M34 30 L126 146", 1)}
          {P("M126 30 L34 146", 2)}
          <ellipse
            className="pl"
            pathLength={1}
            cx="80"
            cy="30"
            rx="46"
            ry="9"
            style={{ "--k": 3 } as CSSProperties}
          />
          <ellipse
            className="pl"
            pathLength={1}
            cx="80"
            cy="146"
            rx="46"
            ry="9"
            style={{ "--k": 4 } as CSSProperties}
          />
          <ellipse className="dash" cx="80" cy="88" rx="62" ry="8" />
          <path
            className="dash warm"
            d="M68 152 C74 124 78 104 80 88 S87 52 94 28"
          />
          <circle className="dot" cx="80" cy="88" r="3" />
          <text x="88" y="16">
            t
          </text>
          <text x="146" y="92">
            x
          </text>
          <text x="80" y="58" textAnchor="middle">
            future
          </text>
          <text x="80" y="124" textAnchor="middle">
            past
          </text>
        </svg>
        <figcaption>
          <b>Fig. 1</b> Light cone
        </figcaption>
      </figure>

      <figure className="study s2">
        <svg viewBox="0 0 160 168" aria-hidden="true">
          {grid.map((d, i) => (
            <path
              key={i}
              d={d}
              pathLength={1}
              className="pl thin"
              style={{ "--k": i * 0.35 } as CSSProperties}
            />
          ))}
          <path className="dash" d="M6 36 L154 52" />
          {P("M6 36 Q82 62 154 28", 7, "warm")}
          <circle className="dot" cx="80" cy="82" r="5.5" />
          <circle className="ring" cx="80" cy="82" r="11" />
        </svg>
        <figcaption>
          <b>Fig. 2</b> Mass bends the grid
        </figcaption>
      </figure>

      <figure className="study s3">
        <svg viewBox="0 0 160 168" aria-hidden="true">
          {P("M72 8 Q88 40 72 72 Q56 40 72 8", 0)}
          {P("M8 22 L70 22 L132 40 L152 46", 1, "warm")}
          {P("M8 40 L152 40", 2, "warm")}
          {P("M8 58 L70 58 L132 40 L152 34", 3, "warm")}
          <circle className="dot" cx="132" cy="40" r="2.4" />
          <text x="132" y="54" textAnchor="middle">
            f
          </text>
          {P("M56 156 L104 156 L80 106 Z", 4)}
          {P("M6 146 L66 134 L92 130", 5, "warm")}
          {P("M92 130 L154 118", 6, "sp sp1")}
          {P("M92 130 L154 127", 6.3, "sp sp2")}
          {P("M92 130 L154 136", 6.6, "sp sp3")}
          {P("M92 130 L154 145", 6.9, "sp sp4")}
          {P("M92 130 L154 154", 7.2, "sp sp5")}
        </svg>
        <figcaption>
          <b>Fig. 3</b> Lens and prism
        </figcaption>
      </figure>

      <figure className="study s4">
        <svg viewBox="0 0 160 168" aria-hidden="true">
          <g transform="translate(80 84) rotate(-18)">
            {P(orbit, 0)}
            <path className="dash" d="M-70 0 L70 0" />
            <path
              className="dash"
              d="M-50.5 0 L20 34 M-50.5 0 L52 19.6 M-50.5 0 L-20 -34"
            />
            <circle className="dot" cx="-50.5" cy="0" r="5" />
            <circle className="ring" cx="-50.5" cy="0" r="10" />
            <circle className="dot warm" r="3.2" cx={still ? 62 : 0} cy="0">
              {!still && (
                <animateMotion
                  dur="18s"
                  repeatCount="indefinite"
                  path={orbit}
                  keyPoints="0;0.2;0.5;0.8;1"
                  keyTimes="0;0.32;0.5;0.68;1"
                  calcMode="linear"
                />
              )}
            </circle>
          </g>
          <text x="20" y="160">
            equal areas, equal times
          </text>
        </svg>
        <figcaption>
          <b>Fig. 4</b> Orbit
        </figcaption>
      </figure>
    </aside>
  );
}
