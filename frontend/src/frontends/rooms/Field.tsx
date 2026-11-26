// The dark of the study: a sheet of spacetime drawn in brass, bent by the
// one light in the room. A plain 2D canvas so it stays cheap.
import { useEffect, useRef } from "react";

type Props = {
  // "gate": the light follows the pointer and is reported through onLight.
  // "room": the light hangs in one place and breathes.
  mode: "gate" | "room";
  reduced: boolean;
  // Where the light should rest, in viewport pixels.
  home?: () => { x: number; y: number };
  // Called each frame with the light's position and how warm it is (0 to 1).
  onLight?: (x: number, y: number, warmth: number) => void;
  // While true the light stays at home whatever the pointer does.
  held?: boolean;
};

export function Field({ mode, reduced, home, onLight, held }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ home, onLight, held });
  live.current = { home, onLight, held };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) {
      // No canvas: still tell the gate where its light is.
      const rest = live.current.home?.() ?? {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
      live.current.onLight?.(rest.x, rest.y, 1);
      return;
    }
    const small = window.matchMedia("(max-width: 720px)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5);
    let w = 0,
      h = 0,
      frame = 0,
      raf = 0,
      running = false;
    const start = performance.now();
    const rest = () =>
      live.current.home?.() ??
      (mode === "room"
        ? { x: w * 0.72, y: Math.min(h * 0.3, 320) }
        : { x: w / 2, y: h / 2 });
    const light = { x: window.innerWidth / 2, y: -40 };
    let placed = false;
    // The pointer carries the light while it moves; at rest the light goes
    // back to the form so the writing is never left in the dark.
    let pointer: { x: number; y: number; t: number } | null = null;

    // A handful of dust motes that drift through the beam.
    const motes = Array.from({ length: small ? 18 : 42 }, (_, i) => ({
      x: ((i * 9301 + 49297) % 233280) / 233280,
      y: ((i * 4127 + 1013) % 7919) / 7919,
      r: 0.5 + ((i * 37) % 10) / 9,
      s: 0.2 + ((i * 53) % 10) / 14,
    }));

    function size() {
      w = window.innerWidth;
      h = window.innerHeight;
      el!.width = Math.round(w * dpr);
      el!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) draw(performance.now(), true);
    }

    function bend(x: number, y: number, mass: number) {
      const dx = x - light.x,
        dy = y - light.y;
      const d2 = dx * dx + dy * dy;
      const pull = mass / (d2 + 9000);
      return [x - dx * pull, y - dy * pull] as const;
    }

    function draw(now: number, still = false) {
      const t = (now - start) / 1000;
      const warmth = still ? 1 : Math.min(1, t / 1.8);
      // The gate starts already lit enough to read; it only warms further.
      const floor = mode === "gate" ? 0.6 : 0;
      const eased = floor + (1 - floor) * (1 - Math.pow(1 - warmth, 3));
      if (!placed) {
        placed = true;
        if (mode === "gate") Object.assign(light, rest());
      }
      const target =
        mode === "gate" &&
        pointer &&
        !live.current.held &&
        now - pointer.t < 2600
          ? pointer
          : rest();
      if (still) {
        light.x = target.x;
        light.y = target.y;
      } else {
        const k = mode === "gate" ? 0.075 : 0.03;
        light.x += (target.x - light.x) * k;
        light.y += (target.y - light.y) * k;
      }
      live.current.onLight?.(light.x, light.y, eased);

      ctx!.clearRect(0, 0, w, h);
      const reach = Math.max(w, h) * (mode === "gate" ? 0.62 : 0.8);
      const glow = ctx!.createRadialGradient(
        light.x,
        light.y,
        0,
        light.x,
        light.y,
        reach,
      );
      const top = (mode === "gate" ? 0.5 : 0.3) * eased;
      glow.addColorStop(0, `rgba(255, 196, 120, ${top})`);
      glow.addColorStop(0.35, `rgba(201, 162, 90, ${top * 0.42})`);
      glow.addColorStop(1, "rgba(201, 162, 90, 0.035)");
      ctx!.strokeStyle = glow;
      ctx!.lineWidth = 1;

      const gap = small ? 46 : 58;
      const step = small ? 23 : 20;
      const mass =
        (mode === "gate" ? 5200 : 4200) * (0.9 + 0.1 * Math.sin(t * 0.7));
      ctx!.beginPath();
      for (let x = -gap; x <= w + gap; x += gap) {
        for (let y = -gap; y <= h + gap; y += step) {
          const [bx, by] = bend(x, y, mass);
          if (y === -gap) ctx!.moveTo(bx, by);
          else ctx!.lineTo(bx, by);
        }
      }
      for (let y = -gap; y <= h + gap; y += gap) {
        for (let x = -gap; x <= w + gap; x += step) {
          const [bx, by] = bend(x, y, mass);
          if (x === -gap) ctx!.moveTo(bx, by);
          else ctx!.lineTo(bx, by);
        }
      }
      ctx!.stroke();

      // Orbits around the light, each with one small body.
      const rings = small ? [120, 210] : [130, 230, 360];
      rings.forEach((r, i) => {
        const tilt = 0.34 + i * 0.05;
        ctx!.beginPath();
        ctx!.ellipse(light.x, light.y, r, r * tilt, -0.32, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(214, 176, 104, ${(0.2 - i * 0.045) * eased})`;
        ctx!.setLineDash(i === 1 ? [2, 7] : []);
        ctx!.stroke();
        ctx!.setLineDash([]);
        const a = (still ? 0.9 : t * (0.42 / (i + 1))) + i * 2.1;
        const ox = Math.cos(a) * r,
          oy = Math.sin(a) * r * tilt;
        const cos = Math.cos(-0.32),
          sin = Math.sin(-0.32);
        ctx!.beginPath();
        ctx!.arc(
          light.x + ox * cos - oy * sin,
          light.y + ox * sin + oy * cos,
          2.2 - i * 0.4,
          0,
          Math.PI * 2,
        );
        ctx!.fillStyle = `rgba(255, 214, 150, ${0.85 * eased})`;
        ctx!.fill();
      });

      // Dust, brightest where it crosses the light.
      for (const m of motes) {
        const mx = (m.x * w + t * 6 * m.s) % w;
        const my = (m.y * h + h - ((t * 9 * m.s) % h)) % h;
        const d = Math.hypot(mx - light.x, my - light.y);
        const a = Math.max(0, 1 - d / (reach * 0.6)) * 0.7 * eased;
        if (a < 0.02) continue;
        ctx!.beginPath();
        ctx!.arc(mx, my, m.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 220, 170, ${a})`;
        ctx!.fill();
      }
    }

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      frame++;
      // The room behind the pages only needs a slow drift.
      if (mode === "room" && frame % 2) return;
      draw(now);
    }
    function play() {
      if (running || reduced || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    const visible = () => (document.hidden ? stop() : play());
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" && mode === "room") return;
      pointer = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const leave = () => {
      pointer = null;
    };
    // A finger lifting takes the light home; a mouse button does not.
    const lift = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") pointer = null;
    };

    size();
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", visible);
    if (mode === "gate" && !reduced) {
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerdown", move, { passive: true });
      window.addEventListener("pointerup", lift, { passive: true });
      document.documentElement.addEventListener("pointerleave", leave);
    }
    play();
    return () => {
      stop();
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", move);
      window.removeEventListener("pointerup", lift);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, [mode, reduced]);

  return <canvas ref={canvas} className="field" aria-hidden="true" />;
}
