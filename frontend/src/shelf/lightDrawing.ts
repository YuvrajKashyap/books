const spectrum = [
  "#e99572",
  "#ebb676",
  "#dfd08a",
  "#a9c994",
  "#8cbfc6",
  "#a098c5",
];
const stars = [
  [260, 31, 1],
  [270, 66, 0.65],
  [278, 19, 0.85],
  [284, 77, 1.1],
  [292, 33, 0.6],
  [298, 13, 0.7],
  [303, 84, 0.6],
  [330, 17, 1.1],
  [341, 74, 0.8],
  [350, 26, 0.6],
  [358, 55, 0.9],
  [371, 34, 1.45],
  [379, 65, 0.7],
];

// The glass faces and refracted rays share the same intersections in drawing coordinates.
export function drawLight(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  levels: number[],
  x: number,
  y: number,
  pulse: number,
) {
  ctx.setTransform(w / 384, 0, 0, h / 104, 0, 0);
  ctx.clearRect(0, 0, 384, 104);
  const [lamp, prism, lens] = levels;
  const power = Math.min(1, lamp + 0.8 * prism + 0.68 * lens);
  const heat = lamp * (0.86 - 0.12 * y) + 0.44 * prism + 0.34 * lens;
  const cx = 318 + lens * x * 12,
    cy = 62 + lens * y * 10;
  // A single flash travels from the wire to the far edge on each new interaction.
  const front = 42 + 412 * pulse;
  const flash = ctx.createLinearGradient(front - 26, 0, front + 5, 0);
  flash.addColorStop(0, "transparent");
  flash.addColorStop(0.8, "#fff0c8ac");
  flash.addColorStop(1, "transparent");
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
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }

  // The fine ruling is quieter than the optics, like the margin of an instrument drawing.
  const ticks = new Path2D();
  for (let i = 0; i <= 60; i++) {
    const px = 12 + i * 6;
    ticks.moveTo(px, 95);
    ticks.lineTo(px, i % 5 ? 93 : 90.5);
  }
  stroke(ticks, "#ceae6b4a", 0.65);
  const rule = new Path2D("M4 95H380");
  stroke(rule, "#cba96d44", 0.6);

  const entryY = 49 + prism * (y * 8 - 2) + lamp * y * 3;
  const exitY = entryY + 3 + prism * (3 - x * 2);
  const entryX = 190 - ((entryY - 18) * 37) / 63;
  const exitX = 190 + ((exitY - 18) * 34) / 57;
  const beam = new Path2D();
  beam.moveTo(64, 37);
  beam.lineTo(entryX, entryY);
  beam.lineTo(exitX, exitY);
  stroke(
    beam,
    gradient(64, entryX, "#f2cb7c55", "#efdbabcf"),
    0.95 + heat * 0.7,
  );
  if (pulse < 1) stroke(beam, flash, 2.1);

  const face = new Path2D("M190 18L153 81L224 75Z");
  const glass = ctx.createLinearGradient(155, 72, 216, 52);
  glass.addColorStop(0, "#b3a67866");
  glass.addColorStop(0.19, "#e5dfaf35");
  glass.addColorStop(0.48, "#8baf9c17");
  glass.addColorStop(0.8, "#d4cda22b");
  glass.addColorStop(1, "#dfd3a96b");
  ctx.fillStyle = glass;
  ctx.fill(face);
  stroke(face, "#e3d4a5cf", 1.1);
  const edges = new Path2D(
    "M190 18L196 16L231 72L224 75 M196 16L160 78L153 81 M160 78L231 72",
  );
  stroke(edges, "#bcad828c", 0.8);
  const shine = new Path2D("M188 27L162 72 M166 76L199 73 M213 61L220 72");
  stroke(shine, "#e9e1c384", 0.85);

  // The bright trace follows the filament inside the etched glass envelope.
  halo(64, 37, 16 + 16 * heat, `rgba(255,183,74,${0.1 + heat * 0.32})`);
  const wire = new Path2D("M62 47C61 40 57 26 63 24C71 21 66 41 66 47");
  stroke(wire, `rgba(255,201,111,${heat * 0.88})`, 2.4);
  stroke(wire, `rgba(255,246,188,${heat})`, 0.85);

  for (const [sx, sy, size] of stars) {
    halo(sx, sy, size * 2.6, "#eed6a444");
    ctx.fillStyle = "#e0d0a0bc";
    ctx.beginPath();
    ctx.arc(sx, sy, size * 0.73, 0, Math.PI * 2);
    ctx.fill();
  }
  const orbit = new Path2D();
  orbit.ellipse(cx, cy, 34, 26, -0.38, 0.26, 4.9);
  stroke(orbit, "#b4a27b45", 0.7);
  const spread = 0.036 + 0.016 * lamp + prism * (0.032 + 0.014 * x);
  const tilt = -0.058 + prism * y * 0.052;
  const arrival = Math.max(0, 1 - Math.abs(front - cx - 7) / 42);
  let illumination = 0;
  spectrum.forEach((color, i) => {
    const slope = tilt + (i - 2.5) * spread;
    const clearance = cy - (exitY + (cx - exitX) * slope);
    const coupling = Math.exp(-Math.abs(clearance) / 32);
    illumination += coupling / spectrum.length;
    // The two images pass on opposite sides of the lens. Softening the bend
    // at alignment keeps a ray continuous when the pointer crosses its path.
    const bend = Math.tanh(clearance / 8) * coupling * (19 + 20 * lens);
    const ray = new Path2D();
    ray.moveTo(exitX, exitY);
    for (let px = exitX + 3; px <= 384; px += 3) {
      const distance = px - exitX;
      const offset = (px - cx) / 25;
      ray.lineTo(
        px,
        exitY +
          distance * slope -
          (bend * (1 - Math.exp(-distance / 24))) / (1 + offset * offset),
      );
    }
    const ink = ctx.createLinearGradient(exitX, 0, 382, 0);
    ink.addColorStop(0, color + "ee");
    ink.addColorStop(0.62, color + "bb");
    ink.addColorStop(1, color + "00");
    ctx.globalAlpha = 0.5 + 0.48 * power;
    stroke(ray, ink, 1.15 + power * 0.48);
    ctx.globalAlpha = 1;
    if (pulse < 1) stroke(ray, flash, 1.45);
  });
  const light = illumination * (0.25 + power) + arrival * 0.32;
  halo(cx, cy, 13 + light * 14, `rgba(245,201,126,${0.27 + light * 0.35})`);
  if (arrival > 0) {
    const echo = new Path2D();
    const radius = 9 + (front - cx + 35) * 0.21;
    echo.ellipse(cx, cy, radius, radius * 0.68, -0.38, 0, 2 * Math.PI);
    stroke(echo, `rgba(247,218,158,${arrival * 0.53})`, 0.85);
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1 + light * 0.44, 1 + light * 0.44);
  const star = new Path2D();
  star.moveTo(0, -7);
  star.quadraticCurveTo(1, -1, 5, 0);
  star.quadraticCurveTo(1, 1, 0, 7);
  star.quadraticCurveTo(-1, 1, -5, 0);
  star.quadraticCurveTo(-1, -1, 0, -7);
  ctx.fillStyle = "#fff0c4";
  ctx.fill(star);
  ctx.restore();
}
