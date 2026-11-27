// The lamp: one pendulum, and every bit of light on the page derived from
// where its filament is this frame. No React in here. The views hand it
// elements and geometry; it writes transforms and a few custom properties
// in a single requestAnimationFrame pass.

export type SceneBook = {
  el: HTMLElement;
  cx: number; // centre x inside the shelf row, px
  set: number; // how far the book is pushed back, px
  l: number; // the left neighbour's setback
  r: number; // the right neighbour's setback
  dx: number;
  gl: number;
  sa: number;
  sd: number;
  lit: boolean;
};
export type SceneShelf = {
  row: HTMLElement; // carries --up for the books' wall shadows
  shadeEl: HTMLElement | null;
  glintEl: HTMLElement | null;
  index: number;
  books: SceneBook[];
  up: number;
  shade: number;
  bx: number;
  bi: number;
};
export type Scene = {
  root: HTMLElement; // the element whose top-left the shelf geometry is measured from
  shelfH: number;
  bookH: number;
  boardH: number;
  pad: number; // clear space between a case side and the first book
  shelves: SceneShelf[];
};
export type LampEls = {
  root: HTMLElement; // the lamp's own wrapper; it carries --heat and --fil
  arm: HTMLElement;
  cord: HTMLElement;
  anchor: HTMLElement;
  chain: HTMLElement;
  hole: HTMLElement;
  full: HTMLElement;
  haze: HTMLElement;
  canvas: HTMLCanvasElement;
};
export type ReaderLight = {
  glow: HTMLElement;
  shadow: HTMLElement;
  stage: HTMLElement;
};
// A place for the filament to hang, in viewport px.
export type Target = { x: number; y: number };

// How much of the window the shared nav takes: a rail down the left on a
// desktop, a bar across the top on a phone. The shell publishes both on
// <html>; whichever is not in use is 0.
export function navRoom() {
  const css = getComputedStyle(document.documentElement);
  const px = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
  return { left: px("--fx-rail-w"), top: px("--fx-top-h") };
}
type Mote = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  ph: number;
};

const PIVOT_Y = -10;
const GRAVITY = 5200; // px/s², tuned so a 400px cord swings in about 1.8s
const MAX_SWING = 1.35;
const HOLE = 640; // the unscaled size of the darkness texture
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Filament colour by temperature: a dull red thread up to pale gold.
const temps: [number, number, number, number][] = [
  [0, 30, 4, 2],
  [0.06, 122, 22, 6],
  [0.3, 228, 86, 20],
  [0.62, 255, 164, 66],
  [1, 255, 230, 178],
];
function filamentColour(t: number) {
  let i = 1;
  while (i < temps.length - 1 && temps[i][0] < t) i++;
  const a = temps[i - 1];
  const b = temps[i];
  const k = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  return `rgb(${Math.round(mix(a[1], b[1], k))} ${Math.round(mix(a[2], b[2], k))} ${Math.round(mix(a[3], b[3], k))})`;
}

export class Lamp {
  vw = 0;
  vh = 0;
  private x0 = 0; // the left edge of the room, clear of the nav rail
  private y0 = 0; // the foot of the nav bar on a phone
  bx = 0; // the filament, in viewport px
  by = 0;
  private px = 0; // the pivot's place on its rail
  private pxV = 0;
  private L = 200;
  private LV = 0;
  private th = 0;
  private om = 0;
  private chainA = 0;
  private chainV = 0;
  private heat = 0;
  private fil = 0;
  private shownHeat = -1;
  private shownFil = -1;
  private on = true;
  private ready = false;
  private grabbed = false;
  private grab = { x: 0, y: 0 };
  private user: Target | null = null; // where the visitor left the lamp
  private search: { y: number } | null = null;
  private side: -1 | 1 = -1; // which case side the lamp rests beside
  private sideAsk = 0;
  private reading: Target | null = null;
  private ptr = { x: 0, y: 0, t: -1e9 };
  private scrollY = 0;
  private scrolled = 0;
  private fixH = 136;
  private R = 800;
  private S = 4;
  private scene: Scene | null = null;
  private reader: ReaderLight | null = null;
  private dirty = true;
  private raf = 0;
  private last = 0;
  private ctx: CanvasRenderingContext2D | null;
  private motes: Mote[] = [];
  private dpr = 1;
  private off: (() => void)[] = [];
  private lastB = { x: 0, y: 0 };
  private box: DOMRect | null = null;
  private followers = new Set<HTMLElement>();
  // The foot of the pediment. The bulb never hangs lower than just over
  // it, so it stays above the rows it lights.
  private ceiling: HTMLElement | null = null;
  private floorY = Infinity;
  private holeR = -1;
  private frames = 0;
  private watchdog = 0;

  constructor(
    private els: LampEls,
    private opt: { reduced: boolean; lite: boolean },
  ) {
    this.ctx = opt.reduced ? null : els.canvas.getContext("2d");
    this.scrollY = window.scrollY;
    this.resize();
    this.px = this.mid();
    this.L = this.restL();
    if (opt.reduced) {
      this.heat = 1;
      this.fil = 1;
    } else {
      this.fil = 0.02;
    }
    const n = opt.reduced ? 0 : opt.lite ? 34 : 80;
    for (let i = 0; i < n; i++)
      this.motes.push({
        x: Math.random() * this.vw,
        y: Math.random() * this.vh,
        z: 0.3 + Math.random() * 0.7,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 6,
        ph: Math.random() * 6.28,
      });

    const listen = <K extends keyof WindowEventMap>(
      type: K,
      fn: (e: WindowEventMap[K]) => void,
      o?: AddEventListenerOptions,
    ) => {
      window.addEventListener(type, fn, o);
      this.off.push(() => window.removeEventListener(type, fn));
    };
    listen("resize", () => {
      this.resize();
      this.user = null;
    });
    listen("scroll", () => this.onScroll(), { passive: true });
    // The nav publishes its size on <html> when it mounts or changes shape.
    const nav = new MutationObserver(() => this.readNav());
    nav.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });
    this.off.push(() => nav.disconnect());
    listen(
      "pointermove",
      (e) => {
        if (e.pointerType !== "mouse") return;
        this.ptr.x = e.clientX;
        this.ptr.y = e.clientY;
        this.ptr.t = performance.now();
      },
      { passive: true },
    );
    const vis = () => {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      if (!document.hidden) {
        this.last = 0;
        this.dirty = true;
        this.raf = requestAnimationFrame(this.frame);
      }
    };
    document.addEventListener("visibilitychange", vis);
    this.off.push(() => document.removeEventListener("visibilitychange", vis));
    // The first picture is written now, before the page is painted, so the
    // room starts dark and warms from there rather than flashing lit.
    this.bx = this.px;
    this.by = PIVOT_Y + this.L;
    this.write(true);
    this.raf = requestAnimationFrame(this.frame);
    // The finished room never depends on animation frames: if none arrive
    // (a hidden or frozen tab), the lamp is simply lit.
    this.watchdog = window.setTimeout(() => {
      if (this.frames > 2) return;
      this.heat = this.on ? 1 : 0;
      this.fil = this.on ? 1 : 0.05;
      this.write(true);
    }, 2600);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.watchdog);
    this.off.forEach((f) => f());
    this.off = [];
    this.scene = null;
    this.reader = null;
  }

  // ---- what the views tell the lamp -------------------------------------

  // Elements that want the lamp's place and warmth as custom properties.
  // Kept to small subtrees: an inherited property is costly on a large one.
  follow(el: HTMLElement) {
    this.followers.add(el);
    this.shownHeat = -1;
    this.dirty = true;
    return () => {
      this.followers.delete(el);
    };
  }
  setCeiling(el: HTMLElement | null) {
    this.ceiling = el;
    this.dirty = true;
  }
  setReady(ready: boolean) {
    this.ready = ready;
  }
  setOn(on: boolean) {
    this.on = on;
    this.dirty = true;
    if (!this.opt.reduced) this.om += (Math.random() > 0.5 ? 1 : -1) * 0.5;
  }
  setScene(scene: Scene | null) {
    this.scene = scene;
    this.dirty = true;
  }
  setReader(reader: ReaderLight | null) {
    this.reader = reader;
    this.dirty = true;
  }
  // Send the lamp down its side of the case to a height measured from the
  // top of the shelves.
  setSearchTarget(t: { y: number } | null) {
    this.search = t;
    if (t) this.user = null;
  }
  // Send the lamp to a point in the viewport while a book is open.
  setReadingTarget(t: Target | null) {
    this.reading = t;
  }
  kick(v: number) {
    if (this.opt.reduced) return;
    this.om += v;
  }
  grabAt(x: number, y: number) {
    if (this.opt.reduced) return;
    this.grabbed = true;
    this.grab.x = x;
    this.grab.y = y;
  }
  dragTo(x: number, y: number) {
    this.grab.x = x;
    this.grab.y = y;
  }
  release() {
    if (!this.grabbed) return;
    this.grabbed = false;
    this.user = { x: this.px, y: this.L + PIVOT_Y };
    this.om = clamp(this.om, -9, 9);
  }

  // ---- geometry ----------------------------------------------------------

  private restL() {
    const p = clamp(this.scrollY / (this.vh * 0.8), 0, 1);
    return (
      this.y0 +
      (this.vw < 720 ? this.vh * (0.2 + 0.1 * p) : this.vh * (0.24 + 0.2 * p))
    );
  }

  // The middle of the room: the window less the nav rail.
  private mid() {
    return this.x0 + (this.vw - this.x0) / 2;
  }

  private readNav() {
    const { left, top } = navRoom();
    if (left === this.x0 && top === this.y0) return;
    this.x0 = left;
    this.y0 = top;
    this.dirty = true;
  }

  // Where the lamp hangs when nobody has moved it. Over the name at the
  // top of the page; after that beside the case, on the side the visitor
  // is working, so it lights the shelves without hanging in front of them.
  private restX(now: number, side?: -1 | 1) {
    const box = this.box;
    const p = clamp(this.scrollY / (this.vh * 0.8), 0, 1);
    if (
      !box ||
      !this.scene ||
      (side === undefined && p < 0.3 && !this.opt.reduced)
    )
      return this.mid();
    if (side === undefined && !this.opt.lite && now - this.ptr.t < 6000) {
      const w = this.vw - this.x0;
      const ask =
        this.ptr.x > this.x0 + w * 0.62
          ? 1
          : this.ptr.x < this.x0 + w * 0.38
            ? -1
            : 0;
      if (!ask || ask === this.side) this.sideAsk = 0;
      else if (!this.sideAsk) this.sideAsk = now;
      else if (now - this.sideAsk > 650) {
        this.side = ask;
        this.sideAsk = 0;
      }
    }
    const half = this.fixH * 0.316; // half the bulb's width
    const pad = this.scene.pad;
    // A little further out than the first spine, so its sway clears them.
    const out = half + 14;
    return (side ?? this.side) < 0
      ? Math.max(this.minX(), box.left + pad - out)
      : Math.min(this.vw - half * 0.5, box.right - pad + out);
  }

  // The furthest left the pivot may run: clear of the nav rail, with room
  // for half the bulb.
  private minX() {
    const half = this.fixH * 0.316;
    return this.x0 ? this.x0 + half + 8 : half * 0.5;
  }

  // The pivot's rail stops short of the nav rail.
  private fence() {
    const lo = this.minX();
    if (this.x0 && this.px < lo) {
      this.px = lo;
      this.pxV = Math.max(0, this.pxV);
    }
  }

  private resize() {
    const { els } = this;
    this.readNav();
    this.vw = document.documentElement.clientWidth || window.innerWidth;
    this.vh = window.innerHeight;
    this.fixH = this.vw < 720 ? 104 : 136;
    this.R =
      this.vw < 720
        ? Math.max(this.vw * 1.5, 600)
        : clamp(this.vw * 0.95, 900, 1500);
    if (this.opt.reduced) this.R *= 1.5;
    const reach = Math.hypot(this.vw, this.vh) * 1.2;
    this.S = reach / (HOLE / 2);
    this.holeR = -1;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opt.lite ? 1 : 1.5);
    els.canvas.width = Math.round(this.vw * this.dpr);
    els.canvas.height = Math.round(this.vh * this.dpr);
    this.dirty = true;
  }

  // The pool of light. It opens out from the filament as it warms, so the
  // case comes up out of the dark from the bulb outwards.
  private pool() {
    const reach = Math.hypot(this.vw, this.vh) * 1.2;
    const R = this.R * (0.2 + 0.8 * Math.pow(clamp(this.heat, 0, 1), 0.65));
    if (this.holeR > 0 && Math.abs(R - this.holeR) < this.R * 0.008) return;
    this.holeR = R;
    // Stops are px from the filament, written as a share of the scaled square.
    const at = (r: number) => Math.min(99.5, ((r * R) / reach) * 100);
    this.els.hole.style.background = `radial-gradient(circle closest-side, rgba(0,0,0,0) 0%, rgba(0,0,0,.03) ${at(0.18)}%, rgba(0,0,0,.14) ${at(0.36)}%, rgba(0,0,0,.32) ${at(0.55)}%, rgba(0,0,0,.54) ${at(0.76)}%, rgba(0,0,0,.74) ${at(1)}%, rgba(0,0,0,.84) 100%)`;
  }

  private onScroll() {
    const y = window.scrollY;
    const d = y - this.scrollY;
    this.scrollY = y;
    this.dirty = true;
    if (this.opt.reduced) return;
    this.scrolled += Math.abs(d);
    if (this.scrolled > 60) {
      this.user = null; // scrolling takes the lamp back
      this.scrolled = 0;
    }
    if (!this.grabbed) this.om += clamp(d, -80, 80) * 0.0012;
    for (const m of this.motes) m.y -= d * m.z * 0.35;
  }

  // ---- one frame ---------------------------------------------------------

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    this.frames++;
    const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 30) : 1 / 60;
    this.last = now;
    const { opt } = this;

    // Warmth. It starts slowly and gathers, the way a filament does.
    const goal = this.on ? (this.ready ? 1 : 0.3) : 0;
    if (opt.reduced) {
      this.heat = this.on ? 1 : 0;
      this.fil = this.on ? 1 : 0.05;
    } else {
      const rate = goal > this.heat ? 0.6 + 2.5 * this.heat * this.heat : 6;
      this.heat += (goal - this.heat) * (1 - Math.exp(-dt * rate));
      const filGoal = Math.max(goal, this.on ? 0.07 : 0.05);
      const fr = filGoal > this.fil ? 0.6 + 2.5 * this.fil * this.fil : 1.1;
      this.fil += (filGoal - this.fil) * (1 - Math.exp(-dt * fr));
      if (Math.abs(goal - this.heat) < 0.0005) this.heat = goal;
    }

    this.box = this.scene ? this.scene.root.getBoundingClientRect() : null;
    this.floorY =
      this.ceiling && !this.reading
        ? this.ceiling.getBoundingClientRect().bottom - this.fixH * 0.22
        : Infinity;
    if (!opt.reduced) this.swing(dt, now);
    else {
      this.px = this.reading ? this.reading.x : this.restX(now, -1);
      this.L = this.reading
        ? this.reading.y - PIVOT_Y
        : Math.min(
            this.y0 + this.vh * (this.vw < 720 ? 0.26 : 0.36),
            this.maxL(),
          );
      this.th = 0;
    }

    this.bx = this.px + this.L * Math.sin(this.th);
    this.by = PIVOT_Y + this.L * Math.cos(this.th);
    const moved =
      Math.abs(this.bx - this.lastB.x) > 0.05 ||
      Math.abs(this.by - this.lastB.y) > 0.05;
    const warmed =
      Math.abs(this.heat - this.shownHeat) > 0.002 ||
      Math.abs(this.fil - this.shownFil) > 0.002;
    if (moved || warmed || this.dirty) {
      this.lastB.x = this.bx;
      this.lastB.y = this.by;
      this.write(warmed || this.dirty);
      this.dirty = false;
    }
    if (this.ctx) this.dust(dt, now);
  };

  // The longest the cord may be: down to the foot of the pediment.
  private maxL() {
    return Math.max(
      this.vh * 0.08,
      Math.min(this.vh * 0.94, this.floorY - PIVOT_Y),
    );
  }

  private swing(dt: number, now: number) {
    const target =
      this.reading ??
      (this.search && this.box
        ? { x: this.restX(now, -1), y: this.search.y + this.box.top }
        : null) ??
      this.user;
    const steps = 2;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      let ax = 0;
      if (this.grabbed) {
        // The bulb is in the hand. The pivot runs along its rail after it.
        const gx = this.grab.x;
        const gy = Math.max(this.grab.y, PIVOT_Y + 50);
        ax = 60 * (gx - this.px) - 13 * this.pxV;
        this.pxV += ax * h;
        this.px += this.pxV * h;
        this.fence();
        const want = clamp(
          Math.atan2(gx - this.px, gy - PIVOT_Y),
          -MAX_SWING,
          MAX_SWING,
        );
        const prev = this.th;
        this.th += (want - this.th) * Math.min(1, h * 40);
        this.om = mix(this.om, (this.th - prev) / h, 0.3);
        const len = clamp(
          Math.hypot(gx - this.px, gy - PIVOT_Y),
          this.vh * 0.08,
          this.maxL(),
        );
        this.L += (len - this.L) * Math.min(1, h * 40);
        this.LV = 0;
      } else {
        const tx = target ? target.x : this.restX(now);
        const tl = clamp(
          target ? target.y - PIVOT_Y : this.restL(),
          this.vh * 0.08,
          this.maxL(),
        );
        ax = 26 * (tx - this.px) - 9.5 * this.pxV;
        this.pxV += ax * h;
        this.px += this.pxV * h;
        this.fence();
        this.LV += (30 * (tl - this.L) - 10 * this.LV) * h;
        this.L += this.LV * h;
        let al =
          -(GRAVITY / this.L) * Math.sin(this.th) -
          (clamp(ax, -6000, 6000) / this.L) * Math.cos(this.th) -
          0.85 * this.om;
        // A pointer nearby and the lamp leans toward it.
        // Not while it is tucked up at its ceiling: there it keeps clear
        // of the spines.
        if (
          !this.opt.lite &&
          now - this.ptr.t < 1800 &&
          this.heat > 0.5 &&
          this.L < this.maxL() - 24
        ) {
          const lean =
            clamp((this.ptr.x - this.bx) / this.vw, -0.5, 0.5) * 0.12;
          al += 5 * (lean - this.th * 0.25);
        }
        this.om += al * h;
        this.th += this.om * h;
        if (this.th > MAX_SWING || this.th < -MAX_SWING) {
          this.th = clamp(this.th, -MAX_SWING, MAX_SWING);
          this.om *= -0.3;
        }
      }
      // The bulb swings no further left than the nav rail: it knocks
      // against it and comes back.
      if (this.x0 && this.L > 0) {
        const edge = this.x0 + this.fixH * 0.316;
        const least = Math.asin(clamp((edge - this.px) / this.L, -1, 1));
        if (this.th < least) {
          this.th = least;
          if (this.om < 0) this.om *= -0.3;
        }
      }
      // The pull-chain trails the bulb as a small pendulum of its own.
      this.chainV +=
        (-70 * this.chainA - 5 * this.chainV - 1.4 * this.om) * h * 4;
      this.chainV = clamp(this.chainV, -6, 6);
      this.chainA = clamp(this.chainA + this.chainV * h, -0.7, 0.7);
    }
  }

  private write(warm: boolean) {
    const { els, bx, by, heat } = this;
    // Reads first.
    const sceneBox = this.box;
    const stageBox = this.reader?.stage.getBoundingClientRect();

    els.arm.style.transform = `translate3d(${this.px.toFixed(2)}px,${PIVOT_Y}px,0) rotate(${(-this.th).toFixed(4)}rad)`;
    els.cord.style.height =
      Math.max(0, this.L - this.fixH * 0.632).toFixed(1) + "px";
    els.chain.style.transform = `rotate(${(this.th + this.chainA).toFixed(4)}rad)`;
    els.anchor.style.transform = `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0)`;
    // The pool of light reaches a little further into the room than a true
    // point source would, so a lamp beside the case still lights its far end.
    const hx = bx + (this.mid() - bx) * 0.22;
    els.hole.style.transform = `translate3d(${(hx - HOLE / 2).toFixed(1)}px,${(by - HOLE / 2).toFixed(1)}px,0) scale(${this.S.toFixed(3)})`;
    els.haze.style.transform = `translate3d(${(bx - HOLE / 2).toFixed(1)}px,${(by - HOLE / 2).toFixed(1)}px,0) scale(${((this.R * 0.95) / (HOLE / 2)).toFixed(3)})`;
    const root = els.root.style;
    const lx = bx.toFixed(0) + "px";
    const ly = by.toFixed(0) + "px";
    for (const f of this.followers) {
      f.style.setProperty("--lx", lx);
      f.style.setProperty("--ly", ly);
      if (warm) f.style.setProperty("--heat", heat.toFixed(3));
    }
    if (warm) {
      this.shownHeat = heat;
      this.shownFil = this.fil;
      root.setProperty("--heat", heat.toFixed(3));
      root.setProperty("--fil-heat", this.fil.toFixed(3));
      root.setProperty("--fil", filamentColour(this.fil));
      this.pool();
      els.full.style.opacity = (
        1 -
        clamp((heat - 0.05) / 0.75, 0, 1) ** 0.8
      ).toFixed(3);
      els.haze.style.opacity = (heat * 0.9).toFixed(3);
    }
    if (this.reader && stageBox) {
      const cx = stageBox.left + stageBox.width / 2;
      const off = clamp((cx - bx) * 0.2, -110, 110);
      this.reader.shadow.style.transform = `translate3d(${off.toFixed(1)}px,0,0) scaleX(${(1 + Math.abs(off) / 260).toFixed(3)})`;
      this.reader.glow.style.transform = `translate3d(${(bx - stageBox.left).toFixed(1)}px,${(by - stageBox.top).toFixed(1)}px,0)`;
    }
    if (this.scene && sceneBox && !this.opt.reduced)
      this.light(this.scene, sceneBox.left, sceneBox.top);
  }

  // Every shelf and book near the lamp gets its share.
  private light(s: Scene, left: number, top0: number) {
    const { bx, by, heat } = this;
    const R = this.R * 0.92;
    const lite = this.opt.lite;
    const lx = bx - left;
    for (const sh of s.shelves) {
      const top = top0 + sh.index * s.shelfH;
      if (top > this.vh + 200 || top + s.shelfH < -200) continue;
      const feet = top + s.shelfH - s.boardH;
      const tops = feet - s.bookH;
      // Lamp below the tops of the books: their shadows climb the back wall.
      const up = clamp((by - tops) / (s.bookH * 1.15), 0, 1) * heat;
      // Lamp above the shelf: the board overhead throws its shadow down.
      const shade = clamp((top - by) / 320, 0, 1);
      const bi = heat * clamp(1 - Math.abs(by - (top + s.shelfH)) / 460, 0, 1);
      if (Math.abs(up - sh.up) > 0.008)
        sh.row.style.setProperty("--up", (sh.up = up).toFixed(3));
      if (sh.shadeEl && Math.abs(shade - sh.shade) > 0.008) {
        sh.shade = shade;
        sh.shadeEl.style.transform = `scaleY(${(0.16 + shade * 1.5).toFixed(3)})`;
        sh.shadeEl.style.opacity = (0.45 + shade * 0.55).toFixed(3);
      }
      if (sh.glintEl) {
        if (Math.abs(bi - sh.bi) > 0.01)
          sh.glintEl.style.opacity = (sh.bi = bi).toFixed(3);
        if (Math.abs(lx - sh.bx) > 1)
          sh.glintEl.style.transform = `translate3d(${(sh.bx = lx).toFixed(0)}px,0,0)`;
      }

      const vd = by - (feet - s.bookH / 2);
      const vfall = Math.exp(-((vd / (s.bookH * 1.2)) ** 2));
      for (const b of sh.books) {
        const ddx = lx - b.cx;
        const dist = Math.hypot(ddx, vd);
        if (dist > R || heat < 0.02) {
          if (b.lit) {
            b.lit = false;
            b.gl = 0;
            b.sa = 0;
            b.el.style.setProperty("--gl", "0");
            b.el.style.setProperty("--sa", "0");
          }
          continue;
        }
        b.lit = true;
        const bs = b.el.style;
        const dx = clamp(ddx / 380, -1, 1);
        const prox = 1 - dist / R;
        // Gilt answers hardest when the filament is straight in front of it.
        const spec = Math.exp(-((ddx / 64) ** 2)) * vfall;
        const gl = clamp(heat * (prox * prox * 0.55 + spec * 0.75), 0, 1);
        if (Math.abs(dx - b.dx) > 0.012)
          bs.setProperty("--dx", (b.dx = dx).toFixed(3));
        if (Math.abs(gl - b.gl) > 0.012)
          bs.setProperty("--gl", (b.gl = gl).toFixed(3));
        if (!lite) {
          // A prouder neighbour between this book and the lamp shades its edge.
          const proud = ddx < 0 ? b.set - b.l : b.set - b.r;
          const sa =
            proud > 0
              ? clamp(proud / 12, 0, 1) * clamp(Math.abs(ddx) / 240, 0, 1) * 0.9
              : 0;
          const sd = ddx < 0 ? 1 : -1;
          if (Math.abs(sa - b.sa) > 0.015)
            bs.setProperty("--sa", (b.sa = sa).toFixed(3));
          if (sd !== b.sd && sa > 0)
            bs.setProperty("--sd", String((b.sd = sd)));
        }
      }
    }
  }

  // Dust in the air, lit only where the lamp reaches.
  private dust(dt: number, now: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { vw, vh, bx, by, heat, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    if (heat < 0.03) return;
    const R = this.R * 0.62;
    const stir = this.om * this.L * 0.012;
    const t = now / 1000;
    for (const m of this.motes) {
      m.vx += (Math.sin(t * 0.4 + m.ph) * 3 - m.vx * 0.4) * dt;
      m.vy += (Math.cos(t * 0.31 + m.ph * 1.7) * 2.2 - 1.2 - m.vy * 0.4) * dt;
      const ddx = m.x - bx;
      const ddy = m.y - by;
      const d = Math.hypot(ddx, ddy);
      if (d < 260) m.vx += stir * (1 - d / 260) * dt * 40; // the swing stirs the air
      m.x += m.vx * m.z * dt;
      m.y += m.vy * m.z * dt;
      if (m.x < -20) m.x += vw + 40;
      else if (m.x > vw + 20) m.x -= vw + 40;
      if (m.y < -20) m.y += vh + 40;
      else if (m.y > vh + 20) m.y -= vh + 40;
      if (d > R) continue;
      const fall = 1 - d / R;
      const a =
        heat *
        fall *
        fall *
        (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.3 + m.ph * 3))) *
        0.8 *
        m.z;
      if (a < 0.01) continue;
      ctx.fillStyle = `rgba(255,${Math.round(196 + 30 * m.z)},${Math.round(130 + 40 * m.z)},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 0.5 + m.z * 1.3, 0, 6.2832);
      ctx.fill();
    }
  }
}
