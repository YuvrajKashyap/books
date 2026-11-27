// The geometry of the round room and the physics that turn it. No React here.
import type { BookArt, ShelfBook } from "../../../../shared/catalogue";

export type Layout = "spines" | "covers";

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
export const mod = (v: number, n: number) => ((v % n) + n) % n;
export const easeInOut = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
export const roman = ["I", "II", "III", "IV"];

// Everything measured from the room's free area: the window less the shared
// nav (the rail on the left on desktop, the bar on top on phones). The viewer
// stands a little behind the centre of the cylinder, so the wall ahead is at
// true size and the shelves curl in towards them at the edges of the view.
export type Dims = {
  vw: number; // width of the free area
  vh: number; // height of the free area
  ox: number; // where the free area starts, from the window's left edge
  oy: number; // and from its top edge
  phone: boolean;
  u: number; // overall scale
  R: number; // radius of the shelf fronts
  P: number; // perspective distance, eye to the wall ahead
  H: number; // height of an average book
  coverW: number;
  pitch: number; // tier to tier
  lip: number; // height of a shelf edge
  shelfDepth: number;
  phiVis: number; // half of the arc that is on screen
  phiMount: number; // half of the arc that is built
  sigma: number; // angle of one wall segment
  ow: number; // width of the oculus
  fw: number; // diameter of the floor compass
  cy: number; // how far the eye line sits from the middle of the screen
};

export function measure(vw: number, vh: number, ox = 0, oy = 0): Dims {
  const phone = vw < 720;
  const u = phone
    ? clamp(vh / 900, 0.7, 0.86)
    : clamp(Math.min(vw / 1280, vh / 800), 0.74, 1.05);
  const R = phone ? clamp(vw * 0.86, 290, 560) : clamp(vw * 0.52, 560, 880);
  const d = R * 0.6;
  const P = R + d;
  // The wall runs on behind the rail, so the arc reaches to the window's
  // left edge, not just to the edge of the free area.
  const reach = vw / 2 + ox;
  let phiVis = 0.3;
  while (
    phiVis < 1.45 &&
    (P * R * Math.sin(phiVis)) / (R * Math.cos(phiVis) + d) < reach
  )
    phiVis += 0.01;
  const H = Math.round(190 * u);
  const coverW = Math.round(124 * u);
  const segments = Math.max(18, Math.round((2 * Math.PI * R) / (118 * u)));
  return {
    vw,
    vh,
    ox,
    oy,
    phone,
    u,
    R,
    P,
    H,
    coverW,
    pitch: Math.round(262 * u),
    lip: Math.round(18 * u),
    shelfDepth: coverW + Math.round(14 * u),
    phiVis,
    phiMount: Math.min(phiVis + 0.26, 1.72),
    sigma: (2 * Math.PI) / segments,
    ow: phone ? Math.min(vw * 1.25, 640) : Math.min(vw * 0.62, vh * 1.02, 940),
    fw: phone ? Math.min(vw * 1.3, 620) : Math.min(vw * 0.74, vh * 1.05, 900),
    // Phones lift the eye line a touch so the floor has room at the foot.
    cy: phone ? -Math.round(vh * 0.03) : -Math.round(vh * 0.012),
  };
}

export function thickness(art: BookArt, u: number) {
  return Math.max(Math.round(13 * u), Math.round(art.depth * u * 1.06));
}

// One shelf that runs all the way round: the books of one category, each with
// the angle of its centre. A lap of a tier is its own length, so a long tier
// simply takes longer to walk; only the arc facing the viewer is ever built.
export type Tier = {
  index: number;
  focus: string;
  books: ShelfBook[];
  arts: BookArt[];
  angle: number[];
  lap: number;
  seam: number; // where the brass tier plate stands, centred in its own bay
  bay: number; // arc of the clear bay the plate stands in, in radians
  // How this tier stands. A tier too short to fill the view as spines is
  // shown face-out and spaced round the whole lap, whatever was asked for.
  layout: Layout;
  // Face-out books with room between them, each on its own stand and light.
  spaced: boolean;
};

export type Anchor = { id: string; angle: number } | undefined;

export function layTier(
  index: number,
  focus: string,
  books: ShelfBook[],
  arts: BookArt[],
  layout: Layout,
  dims: Dims,
  anchor: Anchor,
): Tier {
  const { u, R } = dims;
  // The plate stands alone in a bay: its own width plus a clear margin on
  // each side, so neither the first book nor the last, pulled out and
  // turned, can reach it.
  const plateBay = (dims.phone ? 112 + 2 * 64 : 112 + 2 * 104) * u;
  const minLap = (2 * dims.phiMount + 0.4) * R;
  const spineGap = Math.max(2, 3 * u);
  const n = arts.length;
  const asSpines =
    plateBay + arts.reduce((s, a) => s + thickness(a, u) + spineGap, 0);
  const stands: Layout =
    layout === "spines" && asSpines < 2 * dims.phiVis * R * 1.15
      ? "covers"
      : layout;
  let gap = stands === "spines" ? spineGap : 18 * u;
  if (stands === "covers" && n > 1) {
    // A short tier spreads its books evenly round the lap rather than
    // bunching them up and leaving a bare wall.
    const room = (minLap - plateBay - n * dims.coverW) / (n - 1);
    if (room > gap) gap = Math.min(dims.coverW * 1.6, room);
  }
  let x = 0;
  const angle: number[] = [];
  for (const art of arts) {
    const w = stands === "spines" ? thickness(art, u) : dims.coverW;
    angle.push((x + w / 2) / R);
    x += w + gap;
  }
  const lastEnd = n ? x - gap : 0;
  const lap = Math.max(lastEnd + plateBay, minLap);
  // The plate sits in the middle of whatever wall is left between the last
  // book and the first one round again.
  const seamAt = (lastEnd + lap) / 2;
  let offset = 0;
  if (anchor) {
    const at = books.findIndex((b) => b.id === anchor.id);
    if (at >= 0) offset = anchor.angle - angle[at];
  }
  return {
    index,
    focus,
    books,
    arts,
    angle: angle.map((a) => a + offset),
    lap: lap / R,
    seam: seamAt / R + offset,
    bay: (lap - lastEnd) / R,
    layout: stands,
    spaced: stands === "covers" && gap > dims.coverW * 0.45,
  };
}

// The tiers that can be on screen with the ladder at `lift`: every tier whose
// books reach into the view, above and below, so the room reads as tall.
export function tierWindow(D: Dims, lift: number) {
  const base = D.H * 0.53;
  const margin = 0.15;
  // The floor and the dome cover the very bottom and top of the view.
  const below = (D.vh / 2 - D.cy - base + D.H - D.fw * 0.1) / D.pitch + margin;
  const above = (D.vh / 2 + D.cy + base - D.ow * 0.1) / D.pitch + margin;
  return {
    lo: clamp(Math.ceil(lift - above), 0, 3),
    hi: clamp(Math.floor(lift + below), 0, 3),
  };
}

// The copy of an angle on this tier that is nearest to where the room points.
export function near(tier: Tier, angle: number, turn: number) {
  return angle + tier.lap * Math.round((turn - angle) / tier.lap);
}

// The book straight ahead on a tier.
export function frontOf(tier: Tier, turn: number) {
  let best = -1,
    bestGap = Infinity,
    bestAngle = turn;
  for (let i = 0; i < tier.angle.length; i++) {
    const a = near(tier, tier.angle[i], turn);
    const gap = Math.abs(a - turn);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
      bestAngle = a;
    }
  }
  return { index: best, angle: bestAngle };
}

export function headingOf(tier: Tier, turn: number) {
  if (!tier.angle.length) return 0;
  return (mod(turn - tier.angle[0], tier.lap) / tier.lap) * 360;
}
export function bearingOfBook(tier: Tier, i: number) {
  return (mod(tier.angle[i] - tier.angle[0], tier.lap) / tier.lap) * 360;
}

type Mode = "idle" | "drag" | "coast" | "spring" | "tween";

// The turn of the room and the height of the ladder. Dragging sets the turn
// directly; letting go coasts on friction, then a spring seats the nearest
// book in front. Long programmed turns are eased.
export class Motion {
  turn = 0;
  vel = 0;
  lift = 0;
  liftVel = 0;
  liftTarget = 0;
  liftHeld = false;
  mode: Mode = "idle";
  drift = 0;
  instant = false;
  snap: (turn: number) => number = (t) => t;
  onJump: () => void = () => {};
  private target = 0;
  private from = 0;
  private to = 0;
  private t0 = 0;
  private dur = 1;
  private lastDrag = 0;

  get busy() {
    return (
      this.mode !== "idle" ||
      this.drift !== 0 ||
      this.liftHeld ||
      Math.abs(this.lift - this.liftTarget) > 0.0005 ||
      Math.abs(this.liftVel) > 0.001
    );
  }

  // Jump to wherever the motion was heading. Used when frames stop coming
  // (a background tab, a frozen page) so the room is never left half-turned.
  finish() {
    if (this.mode === "tween") this.turn = this.to;
    else if (this.mode === "spring") this.turn = this.target;
    else if (this.mode === "coast") this.turn = this.snap(this.turn);
    else if (this.mode === "drag") return;
    this.vel = 0;
    this.mode = "idle";
    if (!this.liftHeld) {
      this.lift = this.liftTarget;
      this.liftVel = 0;
    }
  }

  turnTo(to: number, ms: number, now: number) {
    if (this.instant || ms <= 0) {
      if (Math.abs(to - this.turn) > 0.001) this.onJump();
      this.turn = to;
      this.vel = 0;
      this.mode = "idle";
      return;
    }
    this.from = this.turn;
    this.to = to;
    this.t0 = now;
    this.dur = ms;
    this.mode = "tween";
  }
  rideTo(tier: number) {
    this.liftTarget = clamp(tier, 0, 3);
    if (this.instant) {
      this.lift = this.liftTarget;
      this.liftVel = 0;
    }
  }
  grab() {
    this.mode = "drag";
    this.vel = 0;
  }
  dragBy(dTurn: number, now: number) {
    const dt = Math.max(0.004, (now - this.lastDrag) / 1000);
    this.lastDrag = now;
    this.turn += dTurn;
    this.vel = clamp(this.vel * 0.6 + (dTurn / dt) * 0.4, -16, 16);
  }
  release(now: number) {
    if (this.mode !== "drag") return;
    if (now - this.lastDrag > 90) this.vel = 0;
    if (this.instant) {
      this.turn = this.snap(this.turn);
      this.vel = 0;
      this.mode = "idle";
      return;
    }
    this.settleOrCoast();
  }
  push(v: number) {
    if (this.instant) {
      this.turn = this.snap(this.turn + v * 0.12);
      this.onJump();
      return;
    }
    this.vel = clamp((this.mode === "tween" ? 0 : this.vel) + v, -16, 16);
    this.mode = "coast";
  }
  private settleOrCoast() {
    if (Math.abs(this.vel) > 0.55) this.mode = "coast";
    else {
      this.target = this.snap(this.turn + this.vel * 0.16);
      this.mode = "spring";
    }
  }

  step(dt: number, now: number) {
    if (this.mode === "coast") {
      this.turn += this.vel * dt;
      this.vel *= Math.exp(-1.7 * dt);
      if (Math.abs(this.vel) < 0.55) this.settleOrCoast();
    } else if (this.mode === "spring") {
      const a = -70 * (this.turn - this.target) - 12.5 * this.vel;
      this.vel += a * dt;
      this.turn += this.vel * dt;
      if (
        Math.abs(this.turn - this.target) < 0.0003 &&
        Math.abs(this.vel) < 0.003
      ) {
        this.turn = this.target;
        this.vel = 0;
        this.mode = "idle";
      }
    } else if (this.mode === "tween") {
      const p = clamp((now - this.t0) / this.dur, 0, 1);
      const next = this.from + (this.to - this.from) * easeInOut(p);
      this.vel = dt > 0 ? (next - this.turn) / dt : 0;
      this.turn = next;
      if (p >= 1) {
        this.vel = 0;
        this.mode = "idle";
      }
    } else if (this.mode === "idle" && this.drift) {
      this.turn += this.drift * dt;
    } else if (this.mode === "drag" && now - this.lastDrag > 120) {
      this.vel *= 0.8;
    }
    if (!this.liftHeld) {
      const a = -46 * (this.lift - this.liftTarget) - 11.5 * this.liftVel;
      this.liftVel += a * dt;
      this.lift += this.liftVel * dt;
      if (
        Math.abs(this.lift - this.liftTarget) < 0.0005 &&
        Math.abs(this.liftVel) < 0.002
      ) {
        this.lift = this.liftTarget;
        this.liftVel = 0;
      }
    }
  }
}
