import { memo, useState, type CSSProperties } from "react";
import { Cover, ink, type ShelfBook } from "../components";
import { bindingDepth, displayTitle, jacketFor } from "./artwork";
import "./volume.css";

// Shelved books expose the head and fore-edge. The foot rests against the wood.
// Project the faces into the DOM to keep jacket images sharp at any resolution.
const width = 112, height = 171;
function plane(w: number, h: number, x: number, y: number, z: number, rx = 0, ry = 0): CSSProperties {
  return { width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2,
    transform: `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}rad) rotateY(${ry}rad)` };
}
function buildFaces(depth: number) { return {
  rounding: Array.from({length:5}, (_, index) => {
    const t = index * .4 - 1, u = t + .4;
    const radius = Math.min(2.8, depth * .095);
    const left = -width/2 - radius * (1-t*t);
    const right = -width/2 - radius * (1-u*u);
    const dz = depth/5;
    return plane(Math.hypot(right-left,dz)+.22, height,
      (left+right)/2, 0, (t+u)*depth/4, 0, Math.atan2(-dz,right-left));
  }),
  front: plane(width,height,0,0,depth/2), back: plane(width,height,0,0,-depth/2,0,Math.PI),
  spine: plane(depth,height,-width/2,0,0,0,-Math.PI/2),
  fore: plane(depth-3,height-4,width/2-2,0,0,0,Math.PI/2),
  head: plane(width-3,depth-3,0,-height/2+2,0,Math.PI/2),
}; }
const geometries = new Map<number, ReturnType<typeof buildFaces>>();
function geometry(depth: number) {
  let faces = geometries.get(depth);
  if (!faces) {
    faces = buildFaces(depth);
    geometries.set(depth, faces);
  }
  return faces;
}
export const BoundVolume = memo(function BoundVolume({ book, showJacket = true, preview = false }: {
  book: ShelfBook;
  showJacket?: boolean;
  preview?: boolean;
}) {
  // Keep a revealed jacket painted through the return trip to the shelf.
  const [hasShownJacket, setHasShownJacket] = useState(showJacket);
  if (showJacket && !hasShownJacket) setHasShownJacket(true);
  const jacket = jacketFor(book);
  const faces = geometry(bindingDepth(book));
  const title = displayTitle(book.title);
  return <span className="volume-pivot" aria-hidden="true" style={{scale:"1 " + (jacket?.heightScale ?? 1), "--buckram":jacket?.cloth ?? ink(book)} as CSSProperties}>
    <span className="volume-turn">
      <span className="volume-plane board-back" style={faces.back}/>
      <span className="volume-plane paper-cut" style={faces.fore}/>
      <span className="volume-plane paper-head" style={faces.head}/>
      {jacket?.spine ? faces.rounding.map((face,i) =>
        <span key={i} className="volume-plane curved-binding" style={{...face,
          backgroundImage: `url("${jacket.spine}")`, backgroundPositionX: (i*25)+"%",
          "--edge-shade": [0.28,0.08,0,0.035,0.22][i]
        } as CSSProperties}/>
      ) : <span className="volume-plane cloth-spine" style={faces.spine}>
        <span className="spine-print">{title}</span>
      </span>}
      <span className="volume-plane board-front" style={{...faces.front,
        "--preview-art": jacket ? `url("${jacket.small || jacket.file}")` : undefined
      } as CSSProperties}>{(showJacket || hasShownJacket) && <Cover book={book} shelf priority={preview}/>}</span>
    </span>
  </span>;
});
