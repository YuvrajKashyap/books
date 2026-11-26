// The pull: one book drawn out of its row until its whole front cover faces
// the visitor, with a brass plate beneath. The books are drawn in a layer
// above the shelves, so nothing on the shelf has to move or be clipped.
// There are two of them: one book can still be going home while the next
// comes out, which is what sweeping along a row looks like.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { BookArt } from "../../../../shared/catalogue";
import type { Layout } from "./Bookcase";

export type PullArgs = {
  id: string;
  slot: HTMLElement; // the book's place on the shelf
  title: string;
  author: string;
  art: BookArt;
  h: number; // its height on the shelf
  t: number; // its spine thickness on the shelf
  layout: Layout;
  keyed: boolean; // pulled by keyboard focus, so it shows a focus ring
  touch: boolean; // pulled by a finger, so the cover itself can be tapped
};
export type PullHandle = {
  el: () => HTMLElement | null;
  pull: (a: PullArgs) => void;
  release: (id?: string) => void;
  // Keep the book out while the reader is on its way.
  hold: (id: string) => void;
  // Hand the pulled pose to the reader and put the book away.
  take: (id: string) => DOMRect | null;
  current: () => string | null;
};
export type Bounds = { left: number; right: number; top: number };

type Pose = { x: number; y: number; s: number; ry: number; rx: number };
type Out = {
  k: number; // which of the two books draws it
  id: string;
  slot: HTMLElement;
  h: number;
  t: number;
  layout: Layout;
  W: number;
  H: number;
  end: Pose;
  timer: number;
  held: boolean;
  returning: boolean;
  since: number;
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const PULLED_TURN = 9; // degrees the pulled cover is still turned
const ASPECT = 0.665;
const HOME_MS = 470; // the return, a little longer than its transition

// How big the book is once it is out.
function measure(a: PullArgs) {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const H =
    a.layout === "spines"
      ? Math.min(clamp(a.h * 1.04, 212, 262), vh * 0.5, (vw - 40) / ASPECT)
      : Math.min(a.h * 1.2, vh * 0.5);
  const h = Math.round(H);
  return { H: h, W: Math.round(h * ASPECT) };
}

export const Pull = forwardRef<
  PullHandle,
  { bounds: () => Bounds; onOpen: (id: string) => void }
>(function Pull({ bounds, onOpen }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([null, null]);
  const plate = useRef<HTMLDivElement>(null);
  const outs = useRef<(Out | null)[]>([null, null]);
  const live = useRef<Out | null>(null);
  const props = useRef({ bounds, onOpen });
  props.current = { bounds, onOpen };
  // What the window listeners below need from the handle.
  const handle = useRef<{ refit: () => void; release: () => void } | null>(
    null,
  );

  useImperativeHandle(ref, () => {
    const part = <T extends HTMLElement = HTMLElement>(
      k: number,
      sel: string,
    ) => items.current[k]?.querySelector<T>(sel) ?? null;

    // Where the book starts (on the shelf) and ends (out, facing).
    function poses(c: Out): { start: Pose; end: Pose } {
      const r = c.slot.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const b = props.current.bounds();
      const spines = c.layout === "spines";
      const s = c.h / c.H;
      // On the shelf a standing book shows its spine: the box is turned a
      // quarter round its spine edge, which is the slot's right side.
      const start: Pose = spines
        ? { x: r.right, y: r.bottom, s, ry: 90, rx: 0 }
        : { x: r.left, y: r.bottom, s, ry: 0, rx: 0 };
      const lo = Math.max(8, b.left + 4);
      const hi = Math.max(lo, Math.min(vw - 8, b.right - 4) - c.W);
      const x = clamp(r.left + r.width / 2 - c.W / 2, lo, hi);
      // Drawn forward over the lip of the shelf; a face-out book lifts.
      let y = spines ? r.bottom + 10 : r.bottom - 16;
      const minTop = b.top + 10;
      if (y - c.H < minTop) y = minTop + c.H;
      const maxBottom = vh - 78; // room for the plate
      if (y > maxBottom) y = Math.max(maxBottom, minTop + c.H);
      return {
        start,
        end: { x, y, s: 1, ry: PULLED_TURN, rx: spines ? 0 : 5 },
      };
    }
    function apply(c: Out, p: Pose) {
      const fly = part(c.k, ".pull-fly");
      const book = part(c.k, ".pull-book");
      if (!fly || !book) return;
      fly.style.transform = `translate3d(${p.x.toFixed(1)}px,${(p.y - c.H).toFixed(1)}px,0) scale(${p.s.toFixed(4)})`;
      book.style.transform = `rotateX(${p.rx}deg) rotateY(${p.ry}deg)`;
    }
    // Everything that hangs off the resting place: vantage, light, shadow.
    function settle(c: Out) {
      const item = items.current[c.k];
      const shadow = part(c.k, ".pull-shadow");
      if (!item || !shadow) return;
      const { end } = c;
      const cx = end.x + c.W / 2;
      const cy = end.y - c.H / 2;
      item.style.perspectiveOrigin = `${cx.toFixed(0)}px ${cy.toFixed(0)}px`;
      item.style.setProperty("--px", cx.toFixed(0) + "px");
      item.style.setProperty("--py", cy.toFixed(0) + "px");
      shadow.style.left = end.x.toFixed(1) + "px";
      shadow.style.top = (end.y - c.H).toFixed(1) + "px";
    }
    function label(c: Out, title: string, author: string) {
      const el = plate.current;
      if (!el) return;
      const vw = document.documentElement.clientWidth;
      const half = Math.min(170, Math.max(110, c.W / 2 + 40));
      el.style.maxWidth = half * 2 + "px";
      const cx = c.end.x + c.W / 2;
      el.style.left =
        clamp(cx, half + 8, Math.max(half + 8, vw - half - 8)).toFixed(1) +
        "px";
      el.style.top = (c.end.y + 14).toFixed(1) + "px";
      if (title) {
        (el.children[0] as HTMLElement).textContent = title;
        (el.children[1] as HTMLElement).textContent = author;
      }
    }
    function still(c: Out, run: () => void) {
      const fly = part(c.k, ".pull-fly");
      const book = part(c.k, ".pull-book");
      if (!fly || !book) return;
      fly.style.transition = "none";
      book.style.transition = "none";
      run();
      void fly.offsetWidth;
      fly.style.transition = "";
      book.style.transition = "";
    }
    function fill(c: Out, a: PullArgs) {
      const item = items.current[c.k];
      if (!item) return;
      item.style.setProperty("--W", c.W + "px");
      item.style.setProperty("--H", c.H + "px");
      item.style.setProperty(
        "--D",
        Math.max(8, Math.round((a.t * c.H) / a.h)) + "px",
      );
      item.style.setProperty("--cloth", a.art.cloth);
      const front = a.art.front ?? a.art.small;
      const img = part<HTMLImageElement>(c.k, ".pull-front");
      const plain = part(c.k, ".pull-plain");
      if (img && plain) {
        img.hidden = !front;
        plain.hidden = Boolean(front);
        (plain.children[0] as HTMLElement).textContent = a.title;
        (plain.children[2] as HTMLElement).textContent = a.author;
        if (front && img.getAttribute("src") !== front) {
          // The small jacket is already on the shelf; it holds the place
          // while the full one arrives.
          img.style.backgroundImage = a.art.small
            ? `url("${a.art.small}")`
            : "none";
          img.src = front;
        }
      }
      const sp = part<HTMLImageElement>(c.k, ".pull-spine img");
      const st = part(c.k, ".pull-spine span");
      if (sp && st) {
        sp.hidden = !a.art.spine;
        if (a.art.spine && sp.getAttribute("src") !== a.art.spine)
          sp.src = a.art.spine;
        st.textContent = a.art.spine ? "" : a.title;
      }
    }
    function finish(c: Out) {
      window.clearTimeout(c.timer);
      if (outs.current[c.k] !== c) return;
      outs.current[c.k] = null;
      delete c.slot.dataset.pulled;
      items.current[c.k]?.classList.remove(
        "is-on",
        "is-out",
        "is-key",
        "is-touch",
      );
      if (live.current === c) {
        live.current = null;
        root.current?.classList.remove("has-plate");
      }
    }
    function release(id?: string) {
      const c = live.current;
      if (!c || (id && c.id !== id) || c.held) return;
      c.returning = true;
      live.current = null;
      root.current?.classList.remove("has-plate");
      // Its shelf went away under it (a category change): no slot to go to.
      if (!c.slot.isConnected) {
        finish(c);
        return;
      }
      items.current[c.k]?.classList.remove("is-out", "is-key", "is-touch");
      apply(c, poses(c).start);
      c.timer = window.setTimeout(() => finish(c), HOME_MS);
    }
    function refit() {
      const c = live.current;
      if (!c) return;
      if (!c.slot.isConnected) {
        release();
        return;
      }
      c.end = poses(c).end;
      still(c, () => apply(c, c.end));
      settle(c);
      label(c, "", "");
    }
    handle.current = { refit, release: () => release() };

    return {
      el: () => root.current,
      current: () => live.current?.id ?? null,
      release,
      pull(a) {
        const host = root.current;
        if (!host) return;
        const now = live.current;
        if (now && now.id === a.id) {
          const item = items.current[now.k];
          item?.classList.toggle("is-key", a.keyed);
          item?.classList.toggle("is-touch", a.touch);
          return;
        }
        if (now) {
          if (now.held) return;
          release();
        }
        // The same book on its way home turns round and comes back out.
        let c = outs.current.find((o) => o?.id === a.id) ?? null;
        if (c) {
          window.clearTimeout(c.timer);
          c.returning = false;
        } else {
          let k = outs.current.findIndex((o) => !o);
          if (k < 0) {
            // Both busy: the one that left longest ago is home now.
            const [p, q] = outs.current as Out[];
            const old = p.since <= q.since ? p : q;
            k = old.k;
            finish(old);
          }
          const { W, H } = measure(a);
          c = {
            k,
            id: a.id,
            slot: a.slot,
            h: a.h,
            t: a.t,
            layout: a.layout,
            W,
            H,
            end: { x: 0, y: 0, s: 1, ry: 0, rx: 0 },
            timer: 0,
            held: false,
            returning: false,
            since: performance.now(),
          };
          outs.current[k] = c;
          fill(c, a);
          const from = poses(c).start;
          const cc = c;
          still(cc, () => apply(cc, from));
          items.current[k]?.classList.add("is-on");
          a.slot.dataset.pulled = "1";
        }
        live.current = c;
        c.end = poses(c).end;
        settle(c);
        label(c, a.title, a.author);
        const item = items.current[c.k];
        if (!item) return;
        item.classList.toggle("is-key", a.keyed);
        item.classList.toggle("is-touch", a.touch);
        void item.offsetWidth;
        item.classList.add("is-out");
        host.classList.add("has-plate");
        apply(c, c.end);
      },
      hold(id) {
        const c = live.current;
        if (!c || c.id !== id) return;
        c.held = true;
        window.clearTimeout(c.timer);
        c.timer = window.setTimeout(() => {
          c.held = false;
          release(id);
        }, 1200);
      },
      take(id) {
        const c = live.current;
        if (!c || c.id !== id) return null;
        const rect = new DOMRect(c.end.x, c.end.y - c.H, c.W, c.H);
        finish(c);
        return rect;
      },
    };
  }, []);

  // The page moves under a pulled book; a touch elsewhere puts it back.
  useEffect(() => {
    const refit = () => handle.current?.refit();
    const away = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || !live.current) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t && root.current?.contains(t)) return;
      if (t?.closest(".bk") !== live.current.slot) handle.current?.release();
    };
    window.addEventListener("scroll", refit, { passive: true });
    window.addEventListener("resize", refit);
    document.addEventListener("pointerdown", away, true);
    const all = outs.current;
    return () => {
      window.removeEventListener("scroll", refit);
      window.removeEventListener("resize", refit);
      document.removeEventListener("pointerdown", away, true);
      for (const c of all) if (c) delete c.slot.dataset.pulled;
    };
  }, []);

  return (
    <div className="pull" ref={root} aria-hidden="true">
      {[0, 1].map((k) => (
        <div
          className="pull-item"
          key={k}
          ref={(el) => {
            items.current[k] = el;
          }}
        >
          <div className="pull-shadow" />
          <div className="pull-fly">
            <div
              className="pull-book"
              onClick={() => {
                const c = live.current;
                if (c && c.k === k) props.current.onOpen(c.id);
              }}
            >
              <div className="pull-spine">
                <img alt="" draggable={false} hidden />
                <span />
                <i className="pull-spine-light" />
              </div>
              <div className="pull-cover">
                <img
                  className="pull-front"
                  alt=""
                  draggable={false}
                  hidden
                  onError={(e) => {
                    // No jacket after all: the plain front stands in.
                    const img = e.currentTarget;
                    img.hidden = true;
                    img.removeAttribute("src");
                    const plain = img.nextElementSibling as HTMLElement | null;
                    if (plain) plain.hidden = false;
                  }}
                />
                <span className="pull-plain" hidden>
                  <b />
                  <i aria-hidden="true" />
                  <em />
                </span>
                <span className="pull-warm" />
                <span className="pull-shade" />
                <span className="pull-sheen" />
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="pull-plate" ref={plate}>
        <b />
        <i />
      </div>
    </div>
  );
});
