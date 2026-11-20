import { useEffect, useRef } from "react";
import { TorusKnotGeometry, Vector3, Euler } from "three";

// A single continuous brass ribbon, drawn by projecting a Three.js knot onto paper.
export default function BrassKnot() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const turns = 144, sides = 12;
    const mesh = new TorusKnotGeometry(.93, .18, turns, sides, 2, 3);
    const buffer = mesh.getAttribute("position");
    const vertices = Array.from({ length: buffer.count }, (_, i) => new Vector3().fromBufferAttribute(buffer, i));
    const projected = vertices.map(v => v.clone());
    const rotation = new Euler();
    let tilt = 0, pitch = 0, targetX = 0, targetY = 0, frame = 0;
    function paint() {
      if (!canvas || !ctx) return;
      frame = 0;
      tilt += (targetX - tilt) * .14; pitch += (targetY - pitch) * .14;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(248 * ratio)) {
        canvas.width = Math.round(248 * ratio); canvas.height = Math.round(172 * ratio);
      }
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.clearRect(0,0,248,172);
      rotation.set(.52 + pitch, -.68 + tilt, -.35);
      projected.forEach((v,i) => v.copy(vertices[i]).applyEuler(rotation));
      const sections = Array.from({length:turns}, (_,i)=>i).sort((a,b)=>projected[a*(sides+1)].z-projected[b*(sides+1)].z);
      ctx.lineJoin = "round";
      for (const i of sections) {
        const base=i*(sides+1), next=base+sides+1;
        for(let j=0;j<sides;j++) {
          const a=projected[base+j], b=projected[next+j], c=projected[next+j+1], d=projected[base+j+1];
          const nz=(b.x-a.x)*(d.y-a.y)-(b.y-a.y)*(d.x-a.x);
          if(nz<0) continue;
          const light=Math.max(0, Math.min(1, .46 + .33*Math.sin(j*Math.PI*2/sides + i*.041 + tilt) + .16*a.y + .09*a.z));
          const patina=light < .32;
          ctx.fillStyle=patina ? `hsl(42 24% ${16+light*70}%)` : `hsl(${32+light*10} ${34+light*27}% ${22+light*57}%)`;
          ctx.beginPath(); ctx.moveTo(124+49*a.x,87-49*a.y);
          for(const v of [b,c,d]) ctx.lineTo(124+49*v.x,87-49*v.y);
          ctx.closePath(); ctx.fill(); ctx.strokeStyle=ctx.fillStyle; ctx.lineWidth=.65; ctx.stroke();
          if(j%3===0) {
            ctx.beginPath(); ctx.moveTo(124+49*a.x,87-49*a.y); ctx.lineTo(124+49*b.x,87-49*b.y);
            ctx.strokeStyle="rgba(255,225,164,.52)"; ctx.lineWidth=.65; ctx.stroke();
          }
        }
      }
      if (Math.abs(targetX-tilt)+Math.abs(targetY-pitch)>.002) frame=requestAnimationFrame(paint);
    }
    function aim(x:number,y:number) {
      targetX=motion.matches ? 0 : x; targetY=motion.matches ? 0 : y;
      if(!frame) frame=requestAnimationFrame(paint);
    }
    function move(e:PointerEvent) {
      const r=canvas!.getBoundingClientRect();
      aim(((e.clientX-r.left)/r.width-.5)*.88,((e.clientY-r.top)/r.height-.5)*.55);
    }
    function rest(){ aim(0,0); }
    paint();
    canvas.addEventListener("pointermove",move);
    canvas.addEventListener("pointerdown",move);
    canvas.addEventListener("pointerleave",rest);
    motion.addEventListener("change",rest);
    return () => { cancelAnimationFrame(frame); mesh.dispose();
      canvas.removeEventListener("pointermove",move); canvas.removeEventListener("pointerdown",move);
      canvas.removeEventListener("pointerleave",rest); motion.removeEventListener("change",rest);
    };
  }, []);
  return <canvas className="brass-knot" ref={ref} width={248} height={172} aria-hidden="true" />;
}
