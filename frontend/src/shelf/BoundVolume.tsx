import { Matrix4 } from "three";
import { useState, type CSSProperties } from "react";
import { Cover, ink, type ShelfBook } from "../components";
import { bindingDepth, displayTitle, jacketFor } from "./artwork";
import "./volume.css";

// Six local planes form one bound volume. Project the Three.js matrices into
// the DOM so the original jacket image stays sharp at any device pixel ratio.
const width = 112, height = 171;
function plane(w: number, h: number, x: number, y: number, z: number, rx = 0, ry = 0): CSSProperties {
  const matrix = new Matrix4().makeRotationX(rx)
    .multiply(new Matrix4().makeRotationY(ry)).setPosition(x, y, z);
  return { width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2,
    transform: "matrix3d(" + matrix.elements.join(",") + ")" };
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
  foot: plane(width-3,depth-3,0,height/2-2,0,-Math.PI/2),
}; }
const geometries = Array.from({length:53}, (_, i) => buildFaces(i+10));
export function BoundVolume({book,showJacket=true}:{book:ShelfBook;showJacket?:boolean}) {
  // Keep a revealed jacket painted through the return trip to the shelf.
  const [hasShownJacket, setHasShownJacket] = useState(showJacket);
  if (showJacket && !hasShownJacket) setHasShownJacket(true);
  const jacket = jacketFor(book);
  const faces = geometries[bindingDepth(book)-10];
  const title = displayTitle(book.title);
  return <span className="volume-pivot" aria-hidden="true" style={{scale:"1 " + (jacket?.heightScale ?? 1), "--buckram":jacket?.cloth ?? ink(book)} as CSSProperties}>
    <span className="volume-turn">
      <span className="volume-plane board-back" style={faces.back}/>
      <span className="volume-plane paper-cut" style={faces.fore}/>
      <span className="volume-plane paper-head" style={faces.head}/>
      <span className="volume-plane paper-head" style={faces.foot}/>
      {jacket?.spine ? faces.rounding.map((face,i) =>
        <span key={i} className="volume-plane curved-binding" style={{...face,
          backgroundImage: `url("${jacket.spine}")`, backgroundPositionX: (i*25)+"%",
          "--edge-shade": [0.28,0.08,0,0.035,0.22][i]
        } as CSSProperties}/>
      ) : <span className="volume-plane cloth-spine" style={faces.spine}>
        <span className="spine-print">{title}</span>
      </span>}
      <span className="volume-plane board-front" style={faces.front}>{(showJacket || hasShownJacket) && <Cover book={book} shelf/>}</span>
    </span>
  </span>;
}
