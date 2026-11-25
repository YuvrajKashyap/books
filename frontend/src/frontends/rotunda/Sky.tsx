// The oculus: a turning starfield, armillary rings, an iris that opens on
// arrival, and the name of the library set around the brass rim.
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { site } from "../../shared/site";

export type SkyHandle = {
  // rot: sky rotation in radians. streak: arc each star smears across.
  // iris: 0 closed to 1 open.
  draw: (rot: number, streak: number, iris: number, time: number) => void;
};

type Star = {
  r: number;
  a: number;
  s: number;
  b: number;
  p: number;
  hue: number;
};

function makeStars(count: number) {
  // A fixed seed keeps the sky the same on every visit.
  let seed = 20261;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const big = rnd() > 0.93;
    stars.push({
      r: Math.sqrt(rnd()) * 1.02,
      a: rnd() * Math.PI * 2,
      s: big ? 1.3 + rnd() * 0.9 : 0.45 + rnd() * 0.7,
      b: big ? 0.9 : 0.35 + rnd() * 0.5,
      p: rnd() * 6.28,
      hue: rnd(),
    });
  }
  return stars;
}

const BLADES = 9;
const ticks = Array.from({ length: 120 }, (_, i) => {
  const a = (i / 120) * Math.PI * 2;
  const long = i % 10 === 0;
  const r0 = 1.03,
    r1 = long ? 1.085 : 1.055;
  return (
    <line
      key={i}
      x1={Math.cos(a) * 500 * r0}
      y1={Math.sin(a) * 180 * r0}
      x2={Math.cos(a) * 500 * r1}
      y2={Math.sin(a) * 180 * r1}
      opacity={long ? 0.95 : 0.5}
    />
  );
});

export const Sky = memo(
  forwardRef<SkyHandle, { width: number; lite: boolean }>(function Sky(
    { width, lite },
    ref,
  ) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const ringA = useRef<SVGGElement>(null);
    const ringB = useRef<SVGGElement>(null);
    const ringC = useRef<SVGGElement>(null);
    const irisHole = useRef<SVGPathElement>(null);
    const irisEdges = useRef<SVGPathElement>(null);
    const irisSvg = useRef<SVGSVGElement>(null);
    const stars = useRef<Star[]>([]);
    const lastIris = useRef(-1);
    const w = Math.round(width),
      h = Math.round(width * 0.36);

    useEffect(() => {
      stars.current = makeStars(lite ? 170 : 340);
    }, [lite]);

    useImperativeHandle(
      ref,
      () => ({
        draw(rot, streak, iris, time) {
          const cv = canvas.current;
          const ctx = cv?.getContext("2d");
          if (cv && ctx) {
            const ratio = cv.width / w;
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            ctx.clearRect(0, 0, w, h);
            const cx = w / 2,
              cy = h / 2,
              rx = w / 2,
              ry = h / 2;
            // The moon sits still while the stars wheel past it.
            const mx = cx + rx * 0.16,
              my = cy + ry * 0.56;
            const glow = ctx.createRadialGradient(mx, my, 0, mx, my, rx * 0.5);
            glow.addColorStop(0, "rgba(214,226,255,0.5)");
            glow.addColorStop(0.12, "rgba(170,190,240,0.2)");
            glow.addColorStop(1, "rgba(120,140,220,0)");
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, w, h);
            ctx.lineCap = "round";
            const smear = Math.abs(streak) > 0.006;
            for (const s of stars.current) {
              const a = s.a + rot;
              const x = cx + Math.cos(a) * s.r * rx;
              const y = cy + Math.sin(a) * s.r * ry;
              const twinkle = 0.72 + 0.28 * Math.sin(time * 0.0013 + s.p);
              const tone =
                s.hue > 0.82
                  ? "255,224,186"
                  : s.hue < 0.2
                    ? "186,206,255"
                    : "236,240,255";
              if (smear) {
                ctx.strokeStyle = `rgba(${tone},${s.b * 0.8})`;
                ctx.lineWidth = s.s * 1.25;
                ctx.beginPath();
                ctx.moveTo(x, y);
                const steps = Math.abs(streak) > 0.14 ? 4 : 2;
                for (let k = 1; k <= steps; k++) {
                  const b = a - (streak * k) / steps;
                  ctx.lineTo(
                    cx + Math.cos(b) * s.r * rx,
                    cy + Math.sin(b) * s.r * ry,
                  );
                }
                ctx.stroke();
              } else {
                ctx.fillStyle = `rgba(${tone},${s.b * twinkle})`;
                ctx.beginPath();
                ctx.arc(x, y, s.s, 0, 6.2832);
                ctx.fill();
              }
            }
            ctx.fillStyle = "rgba(240,244,255,0.96)";
            ctx.beginPath();
            ctx.arc(mx, my, Math.max(5, w * 0.012), 0, 6.2832);
            ctx.fill();
          }
          const deg = (rot * 180) / Math.PI;
          ringA.current?.setAttribute("transform", `rotate(${deg * 1.6})`);
          ringB.current?.setAttribute(
            "transform",
            `rotate(${-deg * 2.3 + 40})`,
          );
          ringC.current?.setAttribute(
            "transform",
            `rotate(${deg * 3.1 + 110})`,
          );
          if (iris !== lastIris.current) {
            lastIris.current = iris;
            const svg = irisSvg.current;
            if (svg) svg.style.display = iris >= 1 ? "none" : "";
            if (iris < 1 && irisHole.current && irisEdges.current) {
              const r = iris * 128;
              const spin = iris * 1.1;
              const pts: [number, number][] = [];
              for (let k = 0; k < BLADES; k++) {
                const a = spin + (k / BLADES) * Math.PI * 2;
                pts.push([Math.cos(a) * r, Math.sin(a) * r]);
              }
              irisHole.current.setAttribute(
                "d",
                "M-140-140H140V140H-140Z M" +
                  pts
                    .map((p) => p[0].toFixed(2) + " " + p[1].toFixed(2))
                    .join("L") +
                  "Z",
              );
              let edges = "";
              for (let k = 0; k < BLADES; k++) {
                const p = pts[k],
                  q = pts[(k + 1) % BLADES];
                const dx = q[0] - p[0],
                  dy = q[1] - p[1];
                const len = Math.hypot(dx, dy) || 1;
                // Each blade edge runs on past the opening to the rim.
                const ex = q[0] + (dx / len) * 190,
                  ey = q[1] + (dy / len) * 190;
                edges += `M${p[0].toFixed(2)} ${p[1].toFixed(2)}L${ex.toFixed(2)} ${ey.toFixed(2)}`;
              }
              irisEdges.current.setAttribute("d", edges);
            }
          }
        },
      }),
      [w, h],
    );

    const dpr =
      typeof window === "undefined"
        ? 1
        : Math.min(lite ? 1.5 : 2, window.devicePixelRatio || 1);
    return (
      <>
        <div className="dome-shell" />
        <div className="oculus" style={{ width: w, height: h }}>
          <canvas
            ref={canvas}
            width={Math.round(w * dpr)}
            height={Math.round(h * dpr)}
            style={{ width: w, height: h }}
            aria-hidden="true"
          />
          <svg
            className="armillary"
            viewBox="-100 -100 200 200"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <g ref={ringA}>
              <circle r="82" />
              <ellipse rx="82" ry="27" />
              <line x1="-90" y1="0" x2="90" y2="0" />
              {Array.from({ length: 36 }, (_, i) => {
                const a = (i / 36) * Math.PI * 2;
                return (
                  <line
                    key={i}
                    x1={Math.cos(a) * 82}
                    y1={Math.sin(a) * 82}
                    x2={Math.cos(a) * (i % 3 ? 79.5 : 77)}
                    y2={Math.sin(a) * (i % 3 ? 79.5 : 77)}
                  />
                );
              })}
            </g>
            <g ref={ringB}>
              <ellipse rx="68" ry="68" />
              <ellipse rx="22" ry="68" />
              <circle cx="0" cy="-68" r="1.6" className="bead" />
              <circle cx="0" cy="68" r="1.6" className="bead" />
            </g>
            <g ref={ringC}>
              <ellipse rx="52" ry="15" />
              <ellipse rx="52" ry="40" />
              <circle cx="52" cy="0" r="1.8" className="bead" />
            </g>
            <circle r="3.2" className="bead" />
          </svg>
          <svg
            ref={irisSvg}
            className="iris"
            viewBox="-100 -100 200 200"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              ref={irisHole}
              fillRule="evenodd"
              d="M-140-140H140V140H-140Z"
            />
            <path ref={irisEdges} className="iris-edge" d="" />
          </svg>
        </div>
        <h1 className="rim">
          <span className="sr-only">{site.name}</span>
          <svg viewBox="-600 -270 1200 540" aria-hidden="true">
            <defs>
              <path id="fx-rotunda-rim-arc" d="M-566 0A566 240 0 0 0 566 0" />
              <linearGradient id="fx-rotunda-brass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f4dfa6" />
                <stop offset="0.45" stopColor="#b98f45" />
                <stop offset="1" stopColor="#6d4f1f" />
              </linearGradient>
            </defs>
            <path
              className="rim-band"
              fillRule="evenodd"
              d="M-582 0A582 254 0 1 0 582 0A582 254 0 1 0-582 0ZM-500 0A500 180 0 1 0 500 0A500 180 0 1 0-500 0Z"
            />
            <ellipse rx="582" ry="254" className="rim-line" />
            <ellipse rx="522" ry="198" className="rim-hair" />
            <ellipse rx="503" ry="182.5" className="rim-line bright" />
            <g className="rim-ticks">{ticks}</g>
            <text className="rim-name">
              <textPath
                href="#fx-rotunda-rim-arc"
                startOffset="50%"
                textAnchor="middle"
              >
                {site.name}
              </textPath>
            </text>
          </svg>
        </h1>
      </>
    );
  }),
);
