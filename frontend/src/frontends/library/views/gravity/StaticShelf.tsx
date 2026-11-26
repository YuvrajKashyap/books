// The calm path, for reduced motion or when WebGL is unavailable: a grid drawn
// once in SVG, and every book on plain shelves of light.
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { warmNote } from "../../../../shared/catalogue";
import { BOOK_H, EYE_H, TILT, aspectOf, project } from "./layout";
import type { Camera, Layout, Slot } from "./layout";

// A still drawing of the fabric with three dents in it.
export function DrawnGrid() {
  const paths = useMemo(() => {
    const cam: Camera = { P: 1000, pitch: TILT, eyeH: EYE_H, ez: 900 };
    const wells = [
      { x: -420, z: -500, d: 150, s: 230 },
      { x: 520, z: -1500, d: 210, s: 300 },
      { x: -900, z: -2700, d: 180, s: 320 },
    ];
    const at = (x: number, z: number) => {
      let dip = 0;
      let px = x;
      let pz = z;
      for (const w of wells) {
        const dx = x - w.x;
        const dz = z - w.z;
        const q = 1 / (1 + (dx * dx + dz * dz) / (w.s * w.s));
        dip += w.d * q * q;
        px -= dx * 0.26 * q * q;
        pz -= dz * 0.26 * q * q;
      }
      const p = project(cam, px, dip, pz);
      return p ? `${(600 + p.x).toFixed(1)},${(470 + p.y).toFixed(1)}` : null;
    };
    const lines: string[] = [];
    for (let gx = -30; gx <= 30; gx++) {
      const pts: string[] = [];
      for (let z = 500; z >= -6000; z -= 60) {
        const p = at(gx * 110, z);
        if (p) pts.push(p);
      }
      lines.push("M" + pts.join("L"));
    }
    for (let gz = 4; gz >= -54; gz--) {
      const pts: string[] = [];
      for (let x = -3300; x <= 3300; x += 60) {
        const p = at(x, gz * 110);
        if (p) pts.push(p);
      }
      lines.push("M" + pts.join("L"));
    }
    return lines.join("");
  }, []);
  return (
    <svg
      className="gs-grid"
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fx-gravity-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.18" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="fx-gravity-mask">
          <rect width="1200" height="800" fill="url(#fx-gravity-fade)" />
        </mask>
      </defs>
      <path
        d={paths}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        mask="url(#fx-gravity-mask)"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type Props = {
  slots: Slot[];
  layout: Layout;
  searching: boolean;
  awayId: string | null;
  onOpen: (id: string, from: DOMRect) => void;
};

export function StaticShelf({
  slots,
  layout,
  searching,
  awayId,
  onOpen,
}: Props) {
  const spines = layout === "spines";
  return (
    <ol className={"gs-shelf" + (spines ? " is-spine" : "")}>
      {slots.map((slot) => {
        const { art, book, id } = slot;
        const h = Math.round(BOOK_H * art.heightScale);
        const w = spines ? art.depth : Math.round(h * aspectOf(id));
        const src = spines ? art.spine : (art.small ?? art.front);
        return (
          <li
            key={id}
            className={
              (searching && !slot.match ? "is-muted" : "") +
              (awayId === id ? " is-away" : "")
            }
          >
            <button
              type="button"
              data-book={id}
              aria-label={`${art.title} by ${book.author}`}
              title={`${art.title} · ${book.author}`}
              style={
                {
                  "--w": w + "px",
                  "--h": h + "px",
                  "--cloth": art.cloth,
                } as CSSProperties
              }
              onClick={(e) =>
                onOpen(id, e.currentTarget.getBoundingClientRect())
              }
              onPointerEnter={() => warmNote(id)}
              onFocus={() => warmNote(id)}
            >
              {src ? (
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              ) : (
                <span className={spines ? "gs-spine-title" : "gs-typeset"}>
                  {art.title}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
