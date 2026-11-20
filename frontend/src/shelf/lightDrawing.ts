const spectrum = ["#e99572", "#ebb676", "#dfd08a", "#a9c994", "#8cbfc6", "#a098c5"];
const stars = [
  [260, 31, 1], [270, 66, .65], [278, 19, .85], [284, 77, 1.1], [292, 33, .6],
  [298, 13, .7], [303, 84, .6], [330, 17, 1.1], [341, 74, .8], [350, 26, .6],
  [358, 55, .9], [371, 34, 1.45], [379, 65, .7],
];

// The glass faces and refracted rays share the same intersections in drawing coordinates.
export function drawLight(ctx: CanvasRenderingContext2D, w: number, h: number,
  levels: number[], x: number, y: number) {
  ctx.setTransform(w / 384, 0, 0, h / 104, 0, 0);
  ctx.clearRect(0, 0, 384, 104);
  const [lamp, prism, lens] = levels;
  function stroke(path: Path2D, color: string | CanvasGradient, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(path);
  }
  function gradient(x0: number, x1: number, start: string, end: string) {
    const wash = ctx.createLinearGradient(x0, 0, x1, 0);
    wash.addColorStop(0, start);
    wash.addColorStop(1, end);
    return wash;
  }
  function halo(cx: number, cy: number, r: number, color: string) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, color);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, 2*r, 2*r);
  }

  // The fine ruling is quieter than the optics, like the margin of an instrument drawing.
  const ticks = new Path2D();
  for (let i = 0; i <= 60; i++) {
    const px = 12 + i * 6;
    ticks.moveTo(px, 95);
    ticks.lineTo(px, i % 5 ? 93 : 90.5);
  }
  stroke(ticks, "#ceae6b4a", .65);
  const rule = new Path2D("M4 95H380");
  stroke(rule, "#cba96d44", .6);

  const entryY = 51 + prism * (y * 8 - 2);
  const exitY = entryY + 4 + prism * (4 - x * 2);
  const entryX = 190 - (entryY - 18) * 37/63;
  const exitX = 190 + (exitY - 18) * 34/57;
  const beam = new Path2D();
  beam.moveTo(69, 40 - prism * y * 4);
  beam.lineTo(entryX, entryY);
  beam.lineTo(exitX, exitY);
  stroke(beam, gradient(69, 172, "#f2cb7c12", "#efdbabcf"), .95 + lamp * .55);

  const face = new Path2D("M190 18L153 81L224 75Z");
  const glass = ctx.createLinearGradient(155, 72, 216, 52);
  glass.addColorStop(0, "#b3a67866");
  glass.addColorStop(.19, "#e5dfaf35");
  glass.addColorStop(.48, "#8baf9c17");
  glass.addColorStop(.8, "#d4cda22b");
  glass.addColorStop(1, "#dfd3a96b");
  ctx.fillStyle = glass;
  ctx.fill(face);
  stroke(face, "#e3d4a5cf", 1.1);
  const edges = new Path2D("M190 18L196 16L231 72L224 75 M196 16L160 78L153 81 M160 78L231 72");
  stroke(edges, "#bcad828c", .8);
  const shine = new Path2D("M188 27L162 72 M166 76L199 73 M213 61L220 72");
  stroke(shine, "#e9e1c384", .85);

  spectrum.forEach((color, i) => {
    const endX = 275 + prism * (8 + 4*x);
    const endY = exitY + (i - 2.5) * (2.6 + prism * (2.4 + x)) + prism * y * 5;
    const ray = new Path2D();
    ray.moveTo(exitX, exitY);
    ray.lineTo(endX, endY);
    const fade = gradient(exitX, endX, color + (prism > .3 ? "d9" : "a0"), color + "00");
    stroke(ray, fade, 1.6 + prism * .6);
  });

  // The bright trace follows the filament inside the etched glass envelope.
  const heat = lamp * (.82 - .16 * y);
  halo(64, 37, 16 + 16 * heat, `rgba(255,183,74,${.10 + heat * .32})`);
  const wire = new Path2D("M62 47C61 40 57 26 63 24C71 21 66 41 66 47");
  stroke(wire, `rgba(255,201,111,${heat * .88})`, 2.4);
  stroke(wire, `rgba(255,246,188,${heat})`, .85);

  const cx = 317 + lens * x * 7, cy = 52 + lens * y * 6;
  for (const [sx, sy, size] of stars) {
    halo(sx, sy, size * 2.6, "#eed6a444");
    ctx.fillStyle = "#e0d0a0bc";
    ctx.beginPath(); ctx.arc(sx, sy, size * .73, 0, Math.PI * 2); ctx.fill();
  }
  const orbit = new Path2D();
  orbit.ellipse(cx, cy, 34, 26, -.38, .26, 4.9);
  stroke(orbit, "#b4a27b45", .7);
  for (let i = 0; i < 3; i++) {
    const ray = new Path2D();
    const base = 37 + i * 4;
    for (let px = 246; px <= 382; px += 2) {
      const d = (px - cx) / (16 + i * 2);
      const py = base + (px - 246) * .065 - (6 + i * 1.2 + lens * (8 + y * 3)) / (1 + d * d);
      if (px === 246) ray.moveTo(px, py);
      else ray.lineTo(px, py);
    }
    const ink = ctx.createLinearGradient(246, 0, 382, 0);
    ink.addColorStop(0, "#c8b68100"); ink.addColorStop(.5, i === 1 ? "#edd5a6d9" : "#c8b68168"); ink.addColorStop(1, "#c8b68100");
    stroke(ray, ink, i === 1 ? 1.15 : .65);
  }
  halo(cx, cy, 14 + lens * 3, "#eac48370");
  const star = new Path2D();
  star.moveTo(cx, cy - 7); star.quadraticCurveTo(cx + 1, cy - 1, cx + 5, cy);
  star.quadraticCurveTo(cx + 1, cy + 1, cx, cy + 7);
  star.quadraticCurveTo(cx - 1, cy + 1, cx - 5, cy);
  star.quadraticCurveTo(cx - 1, cy - 1, cx, cy - 7);
  ctx.fillStyle = "#fff0c4"; ctx.fill(star);
}
