// The drawing layer. One canvas lies over the real shelf and is painted as an
// opaque inked sheet. Light (the pointer, a fixed lamp, the inked matches of a
// search) is accumulated in a small exposure buffer and cut out of the sheet,
// so the photographed shelf underneath shows through, with a warm rim round each live pool.
//
// The canvas is only a window about 1.7 viewports tall that rides inside the
// scrolling sheet, so the lines scroll natively with the books and stay in
// register; it is re-seated when the viewport nears its edge.
import type { Plan, Row, Slot } from "./layout";

const SHEET = "#0b1220";
const LINE = "214,226,245";
const DIM = "126,156,214";
const WARM = "255,184,108";
const GRID = 32;
const ES = 5; // exposure buffer is 1/5 scale
const FADE = 2.1; // seconds for the trail to cool

type Plot = { kind: "intro" | "sweep"; t0: number; first: number };
export type InkOptions = {
  developAll: boolean;
  reduced: boolean;
  paused: boolean;
  filtered: boolean;
};

function buffer() {
  const c = document.createElement("canvas");
  return c;
}
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export class Ink {
  private ctx: CanvasRenderingContext2D | null;
  private expo = buffer();
  private mix = buffer();
  private ex: CanvasRenderingContext2D | null;
  private mx: CanvasRenderingContext2D | null;
  private plan: Plan | null = null;
  private W = 0;
  private winTop = 0;
  private winH = 0;
  private scale = 1;
  private raf = 0;
  private last = 0;
  private cx = -1e4; // last client position of the light
  private cy = -1e4;
  private px = 0;
  private py = 0;
  private lpx = 0;
  private lpy = 0;
  private inside = false;
  private still = 0;
  private grow = 0;
  private heat = 0; // strength of the warm rim round the pointer's pool
  private dev = 0; // 0 sheet, 1 fully developed; animated as a sweep
  private lastStamp = -1e9;
  private cleared = true;
  private fadeAcc = 0;
  private plot: Plot | null = null;
  private shiver = 0;
  private scrollY = 0;
  private scrollT = 0;
  private gridX = 0;
  private gridY = 0;
  private onScreen = true;
  private touched = false; // the visitor has brought their own light
  private lamp: { x: number; y: number } | null = null;
  private opts: InkOptions = {
    developAll: false,
    reduced: false,
    paused: false,
    filtered: false,
  };
  private off: Array<() => void> = [];
  readonly ok: boolean;

  constructor(
    private canvas: HTMLCanvasElement,
    private plate: HTMLElement,
    private root: HTMLElement,
  ) {
    this.ctx = canvas.getContext("2d");
    this.ex = this.expo.getContext("2d");
    this.mx = this.mix.getContext("2d");
    this.ok = Boolean(this.ctx && this.ex && this.mx);
    if (!this.ok) return;
    this.scrollY = window.scrollY;
    const on = <K extends keyof WindowEventMap>(
      type: K,
      fn: (e: WindowEventMap[K]) => void,
    ) => {
      window.addEventListener(type, fn, { passive: true });
      this.off.push(() => window.removeEventListener(type, fn));
    };
    on("pointermove", (e) => {
      if (e.pointerType !== "touch") this.light(e.clientX, e.clientY);
    });
    const touch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) this.light(t.clientX, t.clientY);
    };
    on("touchstart", touch);
    on("touchmove", touch);
    on("touchend", () => this.dark());
    on("touchcancel", () => this.dark());
    on("blur", () => this.dark());
    on("scroll", () => this.scrolled());
    on("resize", () => {
      this.size();
      this.wake();
    });
    const leave = () => this.dark();
    document.documentElement.addEventListener("pointerleave", leave);
    this.off.push(() =>
      document.documentElement.removeEventListener("pointerleave", leave),
    );
    const seen = () => this.wake();
    document.addEventListener("visibilitychange", seen);
    this.off.push(() => document.removeEventListener("visibilitychange", seen));
    document.fonts?.ready.then(() => this.wake()).catch(() => undefined);
  }

  dispose() {
    this.off.forEach((f) => f());
    this.off = [];
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.plan = null;
    for (const c of [this.canvas, this.expo, this.mix]) {
      c.width = 0;
      c.height = 0;
    }
  }

  setPlan(plan: Plan, how: "intro" | "sweep" | "none") {
    const resized =
      !this.plan ||
      this.plan.width !== plan.width ||
      this.plan.height !== plan.height;
    this.plan = plan;
    if (resized) this.size();
    if (how !== "none" && !this.opts.reduced) {
      const first =
        plan.rows.find((r) => r.base + r.board > this.winTopView())?.n ?? 1;
      this.plot = { kind: how, t0: performance.now(), first };
    }
    this.wake();
  }

  setOptions(next: Partial<InkOptions>) {
    this.opts = { ...this.opts, ...next };
    if (this.opts.paused) this.inside = false;
    if (this.opts.reduced) {
      this.plot = null;
      this.dev = 1;
    }
    this.wake();
  }

  setLamp(lamp: { x: number; y: number } | null) {
    this.lamp = lamp;
    this.wake();
  }

  // A burst of light at a point on the sheet, for keyboard focus.
  pulse(x: number, y: number, r: number) {
    if (!this.ex || !this.plan) return;
    this.stamp(x, y, r, 1);
    this.lastStamp = performance.now();
    this.cleared = false;
    this.wake();
  }

  private winTopView() {
    return -this.plate.getBoundingClientRect().top;
  }

  private size() {
    const p = this.plan;
    if (!p || !this.ctx) return;
    const vh = window.innerHeight;
    this.W = p.width;
    this.winH = Math.min(p.height, Math.ceil((vh * 1.7) / ES) * ES);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = Math.min(dpr, Math.sqrt(3.2e6 / (this.W * this.winH)));
    this.canvas.width = Math.max(1, Math.round(this.W * this.scale));
    this.canvas.height = Math.max(1, Math.round(this.winH * this.scale));
    this.canvas.style.width = this.W + "px";
    this.canvas.style.height = this.winH + "px";
    for (const c of [this.expo, this.mix]) {
      c.width = Math.max(1, Math.ceil(this.W / ES));
      c.height = Math.max(1, Math.ceil(this.winH / ES));
    }
    this.cleared = true;
    this.seat(true);
  }

  // Keep the canvas window around the viewport, carrying the exposure with it.
  private seat(force: boolean) {
    const p = this.plan;
    if (!p || !this.ex || !this.mx) return;
    const rect = this.plate.getBoundingClientRect();
    const rootRect = this.root.getBoundingClientRect();
    const vh = window.innerHeight;
    this.onScreen = rect.bottom > -100 && rect.top < vh + 100;
    this.gridX = rect.left - rootRect.left;
    this.gridY = rect.top - rootRect.top;
    const vTop = -rect.top;
    const slack = Math.max(0, this.winH - vh);
    const margin = slack * 0.2;
    const maxTop = Math.max(0, p.height - this.winH);
    const near =
      (vTop < this.winTop + margin && this.winTop > 0) ||
      (vTop + vh > this.winTop + this.winH - margin && this.winTop < maxTop);
    if (!force && !near) return;
    const next = Math.round(clamp(vTop - slack / 2, 0, maxTop) / ES) * ES;
    if (next !== this.winTop || force) {
      const dy = (this.winTop - next) / ES;
      if (!force && !this.cleared) {
        this.mx.globalCompositeOperation = "copy";
        this.mx.globalAlpha = 1;
        this.mx.drawImage(this.expo, 0, 0);
        this.ex.globalCompositeOperation = "copy";
        this.ex.drawImage(this.mix, 0, dy);
        this.ex.globalCompositeOperation = "source-over";
      }
      this.winTop = next;
      this.canvas.style.top = next + "px";
      this.render(performance.now());
    }
  }

  private light(x: number, y: number) {
    this.cx = x;
    this.cy = y;
    this.place();
  }
  private dark() {
    this.inside = false;
    this.cx = this.cy = -1e4;
  }
  private place() {
    const p = this.plan;
    if (!p || this.opts.paused) return;
    const rect = this.plate.getBoundingClientRect();
    const x = this.cx - rect.left;
    const y = this.cy - rect.top;
    const r = this.radius() * 1.2;
    const inside = x > -r && x < p.width + r && y > -r && y < p.height + r;
    this.px = x;
    this.py = y;
    if (inside && !this.inside) {
      this.lpx = x;
      this.lpy = y;
      this.still = 0;
    }
    this.inside = inside;
    if (inside) {
      this.touched = true;
      this.wake();
    }
  }

  private scrolled() {
    const now = performance.now();
    const y = window.scrollY;
    const dt = Math.max(8, now - this.scrollT);
    const v = (Math.abs(y - this.scrollY) / dt) * 1000;
    this.scrollY = y;
    this.scrollT = now;
    if (!this.opts.reduced && dt < 200)
      this.shiver = Math.max(this.shiver, Math.min(1.5, v / 1500));
    this.seat(false);
    if (this.cx > -1e3) this.place();
    this.wake();
  }

  private radius() {
    const base = this.plan?.compact ? 96 : 150;
    return base * (1 + 1.7 * this.grow);
  }

  private stamp(x: number, y: number, r: number, alpha: number) {
    const e = this.ex;
    if (!e) return;
    const gx = x / ES;
    const gy = (y - this.winTop) / ES;
    const gr = r / ES;
    const g = e.createRadialGradient(gx, gy, 0, gx, gy, gr);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,.9)");
    g.addColorStop(0.78, "rgba(255,255,255,.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    e.globalCompositeOperation = "source-over";
    e.globalAlpha = alpha;
    e.fillStyle = g;
    e.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    e.globalAlpha = 1;
  }

  wake() {
    if (!this.raf && this.ok && this.plan && !document.hidden) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    this.raf = 0;
    const p = this.plan;
    if (!p || !this.ex) return;
    const dt = clamp((now - this.last) / 1000, 0.001, 0.05);
    this.last = now;
    const live = !this.opts.developAll && !this.opts.reduced;
    const lit = this.inside && live && !this.opts.paused;

    if (lit) {
      const dist = Math.hypot(this.px - this.lpx, this.py - this.lpy);
      if (dist / dt < 40) this.still += dt;
      else this.still = 0;
      const held = this.still > 0.3;
      this.grow +=
        ((held ? 1 : 0) - this.grow) * Math.min(1, dt * (held ? 0.7 : 5));
      const r = this.radius();
      if (this.still < 5) {
        const steps = Math.max(1, Math.min(24, Math.ceil(dist / (r * 0.35))));
        for (let k = 1; k <= steps; k++) {
          const t = k / steps;
          this.stamp(
            this.lpx + (this.px - this.lpx) * t,
            this.lpy + (this.py - this.lpy) * t,
            r,
            steps > 1 ? 0.6 : 0.24,
          );
        }
        this.lastStamp = now;
        this.cleared = false;
      }
      this.lpx = this.px;
      this.lpy = this.py;
    } else {
      this.grow *= Math.pow(0.02, dt);
    }
    this.heat +=
      ((lit ? 1 : 0) - this.heat) * Math.min(1, dt * (lit ? 7 : 2.5));
    // Develop all crosses the sheet as a sweep of light, and withdraws faster.
    const goal = live ? 0 : 1;
    if (this.dev !== goal)
      this.dev = clamp(this.dev + (goal ? dt / 1.25 : -dt / 0.6));

    // A pool that has been held still for a while is left as it is.
    const frozen = lit && this.still >= 5;
    if (!this.cleared && !frozen) {
      this.fadeAcc += dt;
      if (this.fadeAcc > 0.07) {
        this.ex.globalCompositeOperation = "destination-out";
        this.ex.globalAlpha = 1 - Math.exp(-this.fadeAcc / FADE);
        this.ex.fillStyle = "#000";
        this.ex.fillRect(0, 0, this.expo.width, this.expo.height);
        this.ex.globalAlpha = 1;
        this.ex.globalCompositeOperation = "source-over";
        this.fadeAcc = 0;
      }
      if (now - this.lastStamp > FADE * 4500) {
        this.ex.clearRect(0, 0, this.expo.width, this.expo.height);
        this.cleared = true;
      }
    }
    this.shiver *= Math.pow(0.004, dt);
    if (this.shiver < 0.04) this.shiver = 0;
    if (this.plot) {
      const T = (now - this.plot.t0) / 1000;
      // Once the first shelves are drawn, a test exposure crosses the top one
      // so the sheet shows what light does before anyone has moved.
      if (this.plot.kind === "intro" && live && !this.touched && T > 2) {
        const row = p.rows[Math.min(p.rows.length, this.plot.first) - 1];
        const r = (p.compact ? 96 : 150) * 1.15;
        const t = clamp((T - 2) / 1.4);
        if (row && t < 1) {
          this.stamp(
            -r + (p.width + r * 2) * t,
            (row.top + row.base) / 2,
            r,
            0.55,
          );
          this.lastStamp = now;
          this.cleared = false;
        }
      }
      if (T > (this.plot.kind === "intro" ? 3.6 : 0.95)) this.plot = null;
    }

    if (this.onScreen) this.render(now);

    const more =
      this.plot !== null ||
      this.shiver > 0 ||
      (lit && !frozen) ||
      (!this.cleared && !frozen) ||
      (!lit && (this.grow > 0.01 || this.heat > 0.01)) ||
      (this.dev > 0 && this.dev < 1);
    if (more && !document.hidden) this.raf = requestAnimationFrame(this.tick);
  };

  private rowProgress(r: Row, T: number) {
    const plot = this.plot;
    if (!plot || plot.kind !== "intro") return 1;
    const k = clamp(r.n - plot.first, 0, 5);
    return clamp((T - (0.1 + k * 0.3)) / 0.8);
  }
  private slotProgress(s: Slot, r: Row, T: number) {
    const plot = this.plot;
    if (!plot) return 1;
    if (plot.kind === "sweep") {
      const sx = this.sweepX(T);
      return clamp((sx - s.x) / 50);
    }
    const k = clamp(r.n - plot.first, 0, 5);
    const start = 0.1 + k * 0.3 + ((s.i - r.from) / (r.to - r.from)) * 0.68;
    return clamp((T - start) / 0.18);
  }
  private sweepX(T: number) {
    const t = clamp(T / 0.8);
    return (1 - Math.pow(1 - t, 3)) * (this.W + 60);
  }

  private render(now: number) {
    const c = this.ctx;
    const m = this.mx;
    const p = this.plan;
    if (!c || !m || !p) return;
    const { W, winH, winTop } = this;
    const T = this.plot ? (now - this.plot.t0) / 1000 : 1e6;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.fillStyle = SHEET;
    c.fillRect(0, 0, W, winH);

    // Construction grid, in register with the page's own.
    const ox = ((-this.gridX % GRID) + GRID) % GRID;
    const oy = ((-(this.gridY + winTop) % GRID) + GRID) % GRID;
    const col = Math.round((this.gridX + ox) / GRID);
    const rowN = Math.round((this.gridY + winTop + oy) / GRID);
    for (let x = ox, i = col; x < W; x += GRID, i++) {
      c.fillStyle = `rgba(${LINE},${i % 5 === 0 ? 0.075 : 0.035})`;
      c.fillRect(x, 0, 1, winH);
    }
    for (let y = oy, i = rowN; y < winH; y += GRID, i++) {
      c.fillStyle = `rgba(${LINE},${i % 5 === 0 ? 0.075 : 0.035})`;
      c.fillRect(0, y, W, 1);
    }

    const pen = this.drawInk(c, T, false);

    // Everything that is currently lit.
    m.globalCompositeOperation = "copy";
    m.globalAlpha = 1;
    m.drawImage(this.expo, 0, 0);
    m.globalCompositeOperation = "source-over";
    m.fillStyle = "#fff";
    const all = this.dev >= 1;
    const e = this.dev;
    const devX = e * e * (3 - 2 * e) * (W + 260);
    if (all) m.fillRect(0, 0, this.mix.width, this.mix.height);
    else {
      if (e > 0) {
        const g = m.createLinearGradient((devX - 220) / ES, 0, devX / ES, 0);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        m.fillStyle = g;
        m.fillRect(0, 0, devX / ES, this.mix.height);
        m.fillStyle = "#fff";
      }
      if (this.lamp) {
        const gx = this.lamp.x / ES;
        const gy = (this.lamp.y - winTop) / ES;
        const gr = (p.compact ? 190 : 300) / ES;
        const g = m.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.6, "rgba(255,255,255,.95)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        m.fillStyle = g;
        m.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
        m.fillStyle = "#fff";
      }
      if (this.opts.filtered) {
        for (const r of p.rows) {
          if (!r.live || r.base + r.board < winTop || r.top > winTop + winH)
            continue;
          for (let i = r.from; i < r.to; i++) {
            const s = p.slots[i];
            if (!s.active) continue;
            const a = this.slotProgress(s, r, T);
            if (a <= 0) continue;
            m.globalAlpha = a;
            m.fillRect(
              (s.x - 4) / ES,
              (s.y - winTop - 5) / ES,
              (s.w + 8) / ES,
              (s.h + r.board + 9) / ES,
            );
          }
        }
        m.globalAlpha = 1;
      }
    }
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    const mw = this.mix.width * ES;
    const mh = this.mix.height * ES;
    c.globalCompositeOperation = "destination-out";
    c.drawImage(this.mix, 0, 0, mw, mh);
    c.globalCompositeOperation = "source-over";

    // The line layer stays as a faint overlay on what has developed.
    c.globalAlpha = all ? 0.17 : 0.15;
    this.drawInk(c, T, true);
    c.globalAlpha = 1;

    if (!all) {
      // Warm rim where line meets colour, at the edge of each live pool.
      const ring = (x: number, y: number, r: number, a: number) => {
        const g = c.createRadialGradient(x, y, r * 0.5, x, y, r);
        g.addColorStop(0, `rgba(${WARM},0)`);
        g.addColorStop(0.55, `rgba(${WARM},${a})`);
        g.addColorStop(1, `rgba(${WARM},0)`);
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      };
      if (this.heat > 0.02)
        ring(this.px, this.py - winTop, this.radius() * 0.98, 0.2 * this.heat);
      if (this.lamp)
        ring(this.lamp.x, this.lamp.y - winTop, p.compact ? 190 : 300, 0.2);
      if (e > 0) {
        // The leading edge of the develop-all sweep.
        const g = c.createLinearGradient(devX - 240, 0, devX, 0);
        g.addColorStop(0, `rgba(${WARM},0)`);
        g.addColorStop(0.8, `rgba(${WARM},.22)`);
        g.addColorStop(1, `rgba(${WARM},0)`);
        c.fillStyle = g;
        c.fillRect(devX - 240, 0, 240, winH);
        c.fillStyle = `rgba(255,236,206,.85)`;
        c.fillRect(devX - 48, 0, 1.5, winH);
      }
    }

    if (this.plot?.kind === "sweep") {
      const sx = this.sweepX(T);
      const fade = 1 - clamp((T - 0.7) / 0.25);
      const g = c.createLinearGradient(sx - 90, 0, sx, 0);
      g.addColorStop(0, `rgba(${WARM},0)`);
      g.addColorStop(1, `rgba(${WARM},${0.16 * fade})`);
      c.fillStyle = g;
      c.fillRect(sx - 90, 0, 90, winH);
      c.fillStyle = `rgba(${WARM},${0.9 * fade})`;
      c.fillRect(sx, 0, 1.5, winH);
    }
    if (pen) {
      c.fillStyle = `rgba(${WARM},.25)`;
      c.beginPath();
      c.arc(pen.x, pen.y - winTop, 9, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = `rgb(${WARM})`;
      c.beginPath();
      c.arc(pen.x, pen.y - winTop, 2.4, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Strokes the sheet. Returns the pen position while a row is being drawn.
  private drawInk(c: CanvasRenderingContext2D, T: number, ghost: boolean) {
    const p = this.plan;
    if (!p) return null;
    const { winTop, winH, W } = this;
    const filtered = this.opts.filtered;
    const sh = this.shiver;
    const j = sh ? () => (Math.random() - 0.5) * 2 * sh : () => 0;
    let pen: { x: number; y: number } | null = null;
    const spines = p.mode === "spines";
    c.save();
    c.translate(0, -winTop);
    c.lineJoin = "miter";
    c.lineCap = "butt";

    for (const r of p.rows) {
      if (r.base + r.board + 4 < winTop || r.y > winTop + winH) continue;
      const rp = this.rowProgress(r, T);
      if (rp <= 0) continue;

      // The case: shelf board, sides, and the dimension line above it.
      c.setLineDash(r.live ? [] : [1, 3]);
      c.lineWidth = 1;
      c.strokeStyle = `rgba(${LINE},${r.live ? 0.8 : 0.4})`;
      c.beginPath();
      const bx = W * rp;
      const by = r.base + 0.5 + j();
      c.moveTo(0, by);
      c.lineTo(bx, by);
      c.moveTo(0, by + r.board);
      c.lineTo(bx, by + r.board);
      c.moveTo(0.5, r.top);
      c.lineTo(0.5, by + r.board);
      if (rp >= 1) {
        c.moveTo(W - 0.5, r.top);
        c.lineTo(W - 0.5, by + r.board);
        c.moveTo(0, r.top + 0.5);
        c.lineTo(W, r.top + 0.5);
      }
      c.stroke();
      c.setLineDash([]);

      if (!ghost && rp > 0.55) {
        const a = clamp((rp - 0.55) / 0.45) * (r.live ? 1 : 0.45);
        const dy = r.y + (r.top - r.y) * 0.5 + 0.5;
        const text = p.compact
          ? `S.${String(r.n).padStart(2, "0")}  ${r.to - r.from} VOLS`
          : `SHELF ${String(r.n).padStart(2, "0")}   ${r.to - r.from} VOLS   ${
              r.known
                ? r.pages.toLocaleString("en") +
                  " PP." +
                  (r.known < r.to - r.from ? " KNOWN" : "")
                : "PP. NOT RECORDED"
            }`;
        c.font = `500 ${p.compact ? 8 : 9}px "IBM Plex Mono", ui-monospace, monospace`;
        c.textBaseline = "middle";
        c.textAlign = "center";
        const tw = c.measureText(text).width + 22;
        const mid = (r.x0 + r.x1) / 2;
        c.strokeStyle = `rgba(${DIM},${0.75 * a})`;
        c.fillStyle = `rgba(${DIM},${0.95 * a})`;
        c.beginPath();
        if (r.x1 - r.x0 > tw + 40) {
          c.moveTo(r.x0, dy);
          c.lineTo(mid - tw / 2, dy);
          c.moveTo(mid + tw / 2, dy);
          c.lineTo(r.x1, dy);
        }
        c.moveTo(r.x0 + 0.5, dy - 6);
        c.lineTo(r.x0 + 0.5, r.top - 2);
        c.moveTo(r.x1 - 0.5, dy - 6);
        c.lineTo(r.x1 - 0.5, r.top - 2);
        c.stroke();
        if (r.x1 - r.x0 > tw + 40) {
          c.beginPath();
          c.moveTo(r.x0, dy);
          c.lineTo(r.x0 + 7, dy - 2.6);
          c.lineTo(r.x0 + 7, dy + 2.6);
          c.closePath();
          c.moveTo(r.x1, dy);
          c.lineTo(r.x1 - 7, dy - 2.6);
          c.lineTo(r.x1 - 7, dy + 2.6);
          c.closePath();
          c.fill();
        }
        c.fillText(text, r.x1 - r.x0 > tw + 40 ? mid : r.x0 + tw / 2, dy);
      }

      // Books: inked first, then construction lines.
      for (let pass = 0; pass < 2; pass++) {
        const inked = pass === 0;
        c.lineWidth = inked && filtered ? 1.7 : 1;
        c.strokeStyle = `rgba(${LINE},${inked ? 0.95 : 0.34})`;
        c.setLineDash(inked ? [] : [1.5, 3]);
        c.beginPath();
        for (let i = r.from; i < r.to; i++) {
          const s = p.slots[i];
          if (s.active !== inked) continue;
          const prog = this.slotProgress(s, r, T);
          if (prog <= 0) continue;
          const x = s.x + 0.5 + j();
          const y = s.y + 0.5 + j();
          const w = s.w - 1;
          const h = s.h - 0.5;
          if (prog >= 1) {
            c.rect(x, y, w, h);
            if (!inked) continue;
            if (spines) {
              if (s.w >= 9) {
                c.moveTo(x + 2, y + 7);
                c.lineTo(x + w - 2, y + 7);
                c.moveTo(x + 2, y + h - 7);
                c.lineTo(x + w - 2, y + h - 7);
              }
            } else c.rect(x + 5, y + 5, w - 10, h - 10);
          } else {
            // The pen runs up the left edge, across the head, and down.
            const per = h * 2 + w;
            const d = prog * per;
            c.moveTo(x, y + h);
            c.lineTo(x, y + h - Math.min(d, h));
            let at = { x, y: y + h - Math.min(d, h) };
            if (d > h) {
              c.lineTo(x + Math.min(d - h, w), y);
              at = { x: x + Math.min(d - h, w), y };
            }
            if (d > h + w) {
              c.lineTo(x + w, y + (d - h - w));
              at = { x: x + w, y: y + (d - h - w) };
            }
            if (!ghost && this.plot?.kind === "intro") pen = at;
          }
        }
        c.stroke();
      }
      c.setLineDash([]);
      if (ghost) continue;

      // Category marks on the shelf edge, and the lettering.
      c.lineWidth = 1;
      c.strokeStyle = `rgba(${DIM},.9)`;
      c.beginPath();
      for (let i = r.from; i < r.to; i++) {
        const s = p.slots[i];
        if (!s.active || s.w < 8 || this.slotProgress(s, r, T) < 1) continue;
        const gx = s.x + s.w / 2;
        const gy = r.base + r.board / 2 + 0.5;
        const q = p.compact ? 1.8 : 2.4;
        if (s.cat === 0) {
          c.moveTo(gx + q, gy);
          c.arc(gx, gy, q, 0, Math.PI * 2);
        } else if (s.cat === 1) c.rect(gx - q, gy - q, q * 2, q * 2);
        else if (s.cat === 2) {
          c.moveTo(gx, gy - q);
          c.lineTo(gx + q, gy + q);
          c.lineTo(gx - q, gy + q);
          c.closePath();
        } else {
          c.moveTo(gx, gy - q - 0.6);
          c.lineTo(gx + q + 0.6, gy);
          c.lineTo(gx, gy + q + 0.6);
          c.lineTo(gx - q - 0.6, gy);
          c.closePath();
        }
      }
      c.stroke();

      if (sh > 0.7) continue;
      c.fillStyle = `rgba(${LINE},${filtered ? 0.95 : 0.74})`;
      c.textBaseline = "middle";
      let font = 0;
      for (let i = r.from; i < r.to; i++) {
        const s = p.slots[i];
        if (!s.active || !s.label.length) continue;
        if (this.slotProgress(s, r, T) < 1) continue;
        if (s.fs !== font) {
          font = s.fs;
          c.font = `${font}px "IBM Plex Mono", ui-monospace, monospace`;
        }
        if (spines) {
          c.save();
          c.translate(s.x + s.w / 2 + 0.5, s.y + 13);
          c.rotate(Math.PI / 2);
          c.textAlign = "left";
          c.fillText(s.label[0], 0, 0);
          c.restore();
        } else {
          c.textAlign = "center";
          const lh = font * 1.45;
          let ty = s.y + s.h * 0.24;
          s.label.forEach((line, n) => {
            if (n === s.label.length - 1) {
              c.globalAlpha = 0.6;
              ty = s.y + s.h - 16;
            }
            if (line) c.fillText(line, s.x + s.w / 2, ty);
            ty += lh;
          });
          c.globalAlpha = 1;
        }
      }
    }
    c.restore();
    return pen;
  }
}
