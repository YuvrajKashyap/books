import { Matrix4 } from "three";
import type { CSSProperties } from "react";
import { Cover, ink, type ShelfBook } from "../components";
import { displayTitle } from "./artwork";
import "./volume.css";

// Six local planes form one bound volume. Project the Three.js matrices into
// the DOM so the original jacket image stays sharp at any device pixel ratio.
const width = 112, height = 171, depth = 30;
function plane(w: number, h: number, x: number, y: number, z: number, rx = 0, ry = 0): CSSProperties {
  const matrix = new Matrix4().makeRotationX(rx)
    .multiply(new Matrix4().makeRotationY(ry)).setPosition(x, y, z);
  return { width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2,
    transform: "matrix3d(" + matrix.elements.join(",") + ")" };
}
const faces = {
  front: plane(width,height,0,0,depth/2), back: plane(width,height,0,0,-depth/2,0,Math.PI),
  spine: plane(depth,height,-width/2,0,0,0,-Math.PI/2),
  fore: plane(depth-3,height-4,width/2-2,0,0,0,Math.PI/2),
  head: plane(width-3,depth-3,0,-height/2+2,0,Math.PI/2),
  foot: plane(width-3,depth-3,0,height/2-2,0,-Math.PI/2),
};
export function BoundVolume({book}:{book:ShelfBook}) {
  const title = displayTitle(book.title);
  return <span className="volume-pivot" aria-hidden="true" style={{"--buckram":ink(book)} as CSSProperties}>
    <span className="volume-turn">
      <span className="volume-plane board-back" style={faces.back}/>
      <span className="volume-plane paper-cut" style={faces.fore}/>
      <span className="volume-plane paper-head" style={faces.head}/>
      <span className="volume-plane paper-head" style={faces.foot}/>
      <span className="volume-plane cloth-spine" style={faces.spine}>
        <span className="spine-print" style={{fontSize:title.length>35?8: title.length>22?10:12}}>{title}</span>
      </span>
      <span className="volume-plane board-front" style={faces.front}><Cover book={book} shelf/></span>
    </span>
  </span>;
}
