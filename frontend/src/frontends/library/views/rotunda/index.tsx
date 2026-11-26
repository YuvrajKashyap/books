// Rotunda: you stand at the centre of a round library and turn the shelves
// around you. This file holds the room together: the address, the motion loop,
// the instruments and the reader.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./rotunda.css";
import {
  bookArt,
  focuses,
  searchShelf,
  sortShelf,
  sorts,
  useShelf,
  useShelfKeys,
  type ShelfBook,
  type Sort,
} from "../../../../shared/catalogue";
import { site, useTitle } from "../../../../shared/site";
import {
  Motion,
  bearingOfBook,
  clamp,
  easeInOut,
  frontOf,
  headingOf,
  layTier,
  measure,
  near,
  roman,
  tierWindow,
  type Anchor,
  type Dims,
  type Layout,
  type Tier,
} from "./room";
import { Ring, type Linger, type Win } from "./Shelf";
import { Sky, type SkyHandle } from "./Sky";
import { Compass, type Tick } from "./Compass";
import { Reader, type Place } from "./Reader";
import { Flat } from "./Flat";
import { DockSlot, focusShelfSearch } from "../../Dock";

type Phase = "dark" | "opening" | "live";
const THIRD = (Math.PI * 2) / 3;
const short = (focus: string) => focus.split(" + ")[0];

function useMedia(query: string) {
  const [on, setOn] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const change = () => setOn(mq.matches);
    change();
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, [query]);
  return on;
}

export default function Rotunda() {
  const shelf = useShelf();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const focusParam = params.get("focus");
  const focusIdx = focusParam
    ? (focuses as readonly string[]).indexOf(focusParam)
    : -1;
  const lit = focusIdx >= 0 ? focusIdx : null;
  const sortParam = params.get("sort");
  const sort: Sort = sorts.some((s) => s.value === sortParam)
    ? (sortParam as Sort)
    : "shelf";
  const layout: Layout =
    params.get("layout") === "covers" ? "covers" : "spines";
  const bookParam = params.get("book") ?? undefined;

  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const [flat] = useState(
    () =>
      typeof CSS !== "undefined" &&
      !CSS.supports("transform-style", "preserve-3d"),
  );
  const [dims, setDims] = useState<Dims>(() =>
    measure(
      typeof window === "undefined" ? 1440 : window.innerWidth,
      typeof window === "undefined" ? 900 : window.innerHeight,
    ),
  );
  const [lite] = useState(
    () =>
      typeof navigator !== "undefined" &&
      (navigator.hardwareConcurrency ?? 8) <= 4,
  );
  useEffect(() => {
    let raf = 0;
    const size = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setDims(measure(window.innerWidth, window.innerHeight)),
      );
    };
    window.addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, []);

  // ---- the books, tier by tier ------------------------------------------
  const [motion] = useState(() => new Motion());
  const sorted = useMemo(
    () => sortShelf(shelf.books, sort),
    [shelf.books, sort],
  );
  const groups = useMemo(
    () =>
      focuses.map((f) => {
        const books = sorted.filter((b) => b.focus === f);
        return { books, arts: books.map(bookArt) };
      }),
    [sorted],
  );
  const prevTiers = useRef<Tier[]>([]);
  const tiers = useMemo(
    () =>
      groups.map((g, t) => {
        // Whatever stands in front of the viewer stays there when the shelf
        // is re-ordered, re-measured or its books are turned.
        const before = prevTiers.current[t];
        let anchor: Anchor;
        if (before?.books.length) {
          const f = frontOf(before, motion.turn);
          anchor = { id: before.books[f.index].id, angle: f.angle };
        }
        return layTier(t, focuses[t], g.books, g.arts, layout, dims, anchor);
      }),
    [groups, layout, dims, motion],
  );
  prevTiers.current = tiers;
  const where = useMemo(() => {
    const map = new Map<string, { t: number; i: number }>();
    tiers.forEach((tier, t) =>
      tier.books.forEach((b, i) => map.set(b.id, { t, i })),
    );
    return map;
  }, [tiers]);
  const total = shelf.books.length;

  const found = useMemo(() => {
    if (!q.trim()) return null;
    const scope = lit === null ? sorted : groups[lit].books;
    const hits = searchShelf(scope, q);
    return hits.sort((a, b) => {
      const x = where.get(a.id),
        y = where.get(b.id);
      return (x?.t ?? 0) - (y?.t ?? 0) || (x?.i ?? 0) - (y?.i ?? 0);
    });
  }, [q, lit, sorted, groups, where]);
  const matches = useMemo(
    () => (found ? new Set(found.map((b) => b.id)) : null),
    [found],
  );

  // ---- state the loop reads through refs --------------------------------
  const [active, setActive] = useState(0);
  const [win, setWin] = useState<Win>({ c: 0, lo: 0, hi: 1 });
  const [phase, setPhase] = useState<Phase>("dark");
  // Whether this visit opens with the oculus. Decided once; the instruments
  // and the dark only wait for the entrance while this is set, so a room that
  // never animates is still a finished room.
  const [entering, setEntering] = useState(
    () =>
      !bookParam &&
      !flat &&
      !(
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ),
  );
  const [everCovers, setEverCovers] = useState(layout === "covers");
  const [waveAt, setWaveAt] = useState(0);
  const [linger, setLinger] = useState<Linger>(null);
  const [announce, setAnnounce] = useState("");
  const [matchAt, setMatchAt] = useState(0);
  const [frontId, setFrontId] = useState("");
  const [shown, setShown] = useState<{
    book: ShelfBook;
    closing: boolean;
  } | null>(null);

  const live = useRef({
    tiers,
    dims,
    where,
    lit,
    reduce,
    found,
    reading: false,
    active: 0,
    win,
  });
  live.current.tiers = tiers;
  live.current.dims = dims;
  live.current.where = where;
  live.current.lit = lit;
  live.current.reduce = reduce;
  live.current.found = found;
  live.current.reading = Boolean(shown);

  const root = useRef<HTMLDivElement>(null);
  const space = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dome = useRef<HTMLDivElement>(null);
  const floor = useRef<HTMLDivElement>(null);
  const rose = useRef<HTMLDivElement>(null);
  const shaft = useRef<HTMLDivElement>(null);
  const pool = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const plateTitle = useRef<HTMLElement>(null);
  const plateAuthor = useRef<HTMLSpanElement>(null);
  const pos = useRef<HTMLElement>(null);
  const sky = useRef<SkyHandle>(null);
  const registry = useRef(new Map<string, HTMLElement>());
  const peek = useRef<ShelfBook | null>(null);
  const origin = useRef<Place | null>(null);
  const intro = useRef<{ t0: number; stage: number; home: number } | null>(
    null,
  );
  const iris = useRef(0);
  const placed = useRef(false);
  const stalled = useRef(false);
  const introTimers = useRef<number[]>([]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) registry.current.set(id, el);
    else registry.current.delete(id);
  }, []);
  const onPeek = useCallback((book: ShelfBook | null) => {
    peek.current = book;
  }, []);

  // ---- the address -------------------------------------------------------
  const setParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true, state: location.state },
      );
    },
    [setParams, location.state],
  );
  const setParamRef = useRef(setParam);
  setParamRef.current = setParam;

  // ---- moving about ------------------------------------------------------
  const ride = useCallback(
    (t: number) => {
      const to = clamp(Math.round(t), 0, 3);
      motion.rideTo(to);
      if (live.current.lit !== null && live.current.lit !== to)
        setParamRef.current("focus", focuses[to]);
    },
    [motion],
  );
  const face = useCallback(
    (id: string, ms?: number) => {
      const L = live.current;
      const at = L.where.get(id);
      if (!at) return;
      const tier = L.tiers[at.t];
      const a = near(tier, tier.angle[at.i], motion.turn);
      const far = Math.abs(a - motion.turn);
      motion.turnTo(
        a,
        ms ?? 800 + Math.min(1700, far * 620),
        performance.now(),
      );
      ride(at.t);
    },
    [motion, ride],
  );
  const activeTier = () =>
    live.current.tiers[clamp(Math.round(motion.liftTarget), 0, 3)];
  const stepBook = useCallback(
    (by: number) => {
      const tier = activeTier();
      if (!tier?.books.length) return;
      const f = frontOf(tier, motion.turn);
      const n = tier.books.length;
      const next = tier.books[(f.index + by + n) % n];
      const wasOnBook = document.activeElement?.classList.contains("hit");
      face(next.id, 300);
      if (wasOnBook)
        registry.current
          .get(next.id)
          ?.querySelector<HTMLElement>(".hit")
          ?.focus({ preventScroll: true });
    },
    [motion, face],
  );
  const bay = useCallback(
    (by: number) => {
      const to = motion.snap(
        motion.turn + by * live.current.dims.phiVis * 1.15,
      );
      motion.turnTo(to, 950, performance.now());
    },
    [motion],
  );
  const north = useCallback(() => {
    const tier = activeTier();
    if (tier?.books.length) face(tier.books[0].id);
  }, [face]);

  useEffect(() => {
    motion.instant = reduce;
    motion.snap = (turn) => {
      const tier = activeTier();
      return tier?.books.length ? frontOf(tier, turn).angle : turn;
    };
    motion.onJump = () => {
      const el = stage.current;
      if (!el) return;
      el.classList.remove("xfade");
      void el.offsetWidth;
      el.classList.add("xfade");
    };
  }, [motion, reduce]);

  // First placement: face the owner's front row, a shared book, or a match.
  useLayoutEffect(() => {
    if (placed.current || shelf.state !== "ok" || !total) return;
    placed.current = true;
    const deep = bookParam ? where.get(bookParam) : undefined;
    const hit = found?.length ? where.get(found[0].id) : undefined;
    const first = where.get(shelf.books[0].id);
    const at =
      deep ??
      hit ??
      (lit !== null ? { t: lit, i: 0 } : (first ?? { t: 0, i: 0 }));
    const home = tiers[at.t].angle[at.i] ?? 0;
    motion.lift = motion.liftTarget = at.t;
    const quiet = reduce || flat || Boolean(deep);
    if (quiet) {
      motion.turn = home;
      iris.current = 1;
      setPhase("live");
      setEntering(false);
    } else {
      motion.turn = home - THIRD;
      intro.current = { t0: performance.now(), stage: 0, home };
      // The entrance is also on a clock, so it ends even if no frame is drawn.
      introTimers.current = [
        window.setTimeout(() => {
          if (intro.current) setPhase((p) => (p === "dark" ? "opening" : p));
        }, 1200),
        window.setTimeout(() => endIntro(), 4800),
      ];
    }
    setActive(at.t);
    live.current.active = at.t;
    const w = { c: motion.turn, ...tierWindow(dims, at.t) };
    live.current.win = w;
    setWin(w);
  }, [shelf.state, total, tiers]);

  useEffect(() => () => introTimers.current.forEach(clearTimeout), []);
  const endIntro = useCallback(() => {
    const it = intro.current;
    if (!it) return;
    intro.current = null;
    iris.current = 1;
    if (it.stage < 2) motion.turnTo(it.home, 0, performance.now());
    setPhase("live");
  }, [motion]);

  // A chosen category rides the ladder to its tier.
  useEffect(() => {
    if (lit !== null && placed.current) motion.rideTo(lit);
  }, [lit, motion]);

  // Typing turns the room to the nearest match.
  const firstSearch = useRef(true);
  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    const wait = window.setTimeout(() => {
      const L = live.current;
      const hits = L.found;
      if (!hits?.length || !placed.current) return;
      if (intro.current) endIntro();
      const here = clamp(Math.round(motion.liftTarget), 0, 3);
      let best = 0,
        bestCost = Infinity;
      hits.forEach((b, n) => {
        const at = L.where.get(b.id);
        if (!at) return;
        const tier = L.tiers[at.t];
        const gap = Math.abs(
          near(tier, tier.angle[at.i], motion.turn) - motion.turn,
        );
        const cost = Math.abs(at.t - here) * 100 + gap;
        if (cost < bestCost) {
          bestCost = cost;
          best = n;
        }
      });
      setMatchAt(best);
      face(hits[best].id, 1500 + Math.min(1500, bestCost * 500));
    }, 170);
    return () => clearTimeout(wait);
  }, [q, lit]);
  const stepMatch = (by: number) => {
    if (!found?.length) return;
    const n = (matchAt + by + found.length) % found.length;
    setMatchAt(n);
    face(found[n].id);
  };

  // The dock sets the layout and the search; the room answers from where you
  // stand: books turn in a wave, matches step forward and the rest fall back
  // in a ripple from the centre.
  const lastLayout = useRef(layout);
  useEffect(() => {
    if (layout === lastLayout.current) return;
    lastLayout.current = layout;
    let timer = 0;
    if (!reduce && !flat) {
      setLinger({ ids: new Set(registry.current.keys()), c: motion.turn });
      timer = window.setTimeout(() => setLinger(null), 1500);
    }
    setWaveAt(motion.turn);
    if (layout === "covers") setEverCovers(true);
    return () => clearTimeout(timer);
  }, [layout]);
  const lastQ = useRef(q);
  useEffect(() => {
    if (q === lastQ.current) return;
    lastQ.current = q;
    setWaveAt(motion.turn);
  }, [q]);

  // ---- the reader --------------------------------------------------------
  const openBook = useCallback(
    (book: ShelfBook) => {
      // The flight starts from the copy as it is seen: a cover if it faces
      // you (face-out, or drawn out and turned), else its spine.
      const slot = registry.current.get(book.id);
      const L = live.current;
      const at = L.where.get(book.id);
      const showsCover =
        Boolean(slot) &&
        ((at && L.tiers[at.t].layout === "covers") ||
          (slot!.dataset.front === "1" &&
            root.current?.classList.contains("settled")));
      const seen = slot?.querySelector<HTMLElement>(
        showsCover ? ".face.front" : ".face.spine",
      );
      const flatHit = slot
        ? null
        : root.current?.querySelector<HTMLElement>(`[data-book="${book.id}"]`);
      const r = (seen ?? flatHit)?.getBoundingClientRect();
      origin.current =
        r && r.width > 0 && r.height > 0
          ? {
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
              h: r.height,
              spine: seen ? !showsCover : r.width < r.height * 0.4,
            }
          : null;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("book", book.id);
          return next;
        },
        { state: { rotunda: true } },
      );
    },
    [setParams],
  );
  const closeBook = () => {
    if ((location.state as { rotunda?: boolean } | null)?.rotunda) navigate(-1);
    else setParam("book", null);
  };
  useEffect(() => {
    if (shelf.state !== "ok") return;
    const at = bookParam ? where.get(bookParam) : undefined;
    if (bookParam && at) {
      const book = tiers[at.t].books[at.i];
      if (shown && !shown.closing && shown.book.id === book.id) return;
      if (shown && !shown.closing) face(book.id, 900);
      else if (!origin.current) {
        const tier = tiers[at.t];
        motion.turnTo(near(tier, tier.angle[at.i], motion.turn), 0, 0);
        motion.lift = motion.liftTarget = at.t;
      }
      if (intro.current) endIntro();
      motion.drift = reduce ? 0 : 0.03;
      setShown({ book, closing: false });
    } else if (shown && !shown.closing) {
      motion.drift = 0;
      face(shown.book.id, 620);
      setShown({ book: shown.book, closing: true });
    }
  }, [bookParam, shelf.state, where]);
  const closed = () => {
    const id = shown?.book.id;
    origin.current = null;
    setShown(null);
    if (!id) return;
    requestAnimationFrame(() =>
      (
        registry.current.get(id)?.querySelector<HTMLElement>(".hit") ??
        root.current?.querySelector<HTMLElement>(`[data-book="${id}"]`)
      )?.focus({ preventScroll: true }),
    );
  };
  const stepReader = (by: number) => {
    if (!shown) return;
    const at = where.get(shown.book.id);
    if (!at) return;
    const list = tiers[at.t].books;
    const next = list[(at.i + by + list.length) % list.length];
    setParam("book", next.id);
  };
  let landing: Place = {
    x: dims.vw / 2,
    y: dims.vh / 2,
    h: dims.H,
    spine: true,
  };
  let readerPlace = "";
  if (shown) {
    const at = where.get(shown.book.id);
    const t = at?.t ?? active;
    const h = Math.round(dims.H * bookArt(shown.book).heightScale);
    const shift = dims.P * Math.tan(((1.5 - t) * 2.2 * Math.PI) / 180);
    landing = flat
      ? (origin.current ?? landing)
      : {
          x: dims.vw / 2,
          y: dims.vh / 2 + dims.cy + shift + dims.H * 0.53 - h / 2,
          h,
          spine: tiers[t].layout === "spines",
        };
    if (at)
      readerPlace = `${roman[at.t]} · ${short(focuses[at.t])} · ${at.i + 1} of ${tiers[at.t].books.length}`;
  }

  useTitle(shown && !shown.closing ? bookArt(shown.book).title : undefined);
  useShelfKeys({
    paused: Boolean(shown),
    search: focusShelfSearch,
    enter: () => navigate("/admin"),
  });

  // ---- keys --------------------------------------------------------------
  useEffect(() => {
    if (flat) return;
    const key = (e: KeyboardEvent) => {
      if (live.current.reading || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input,select,textarea")) return;
      const moves: Record<string, () => void> = {
        ArrowLeft: () => stepBook(-1),
        ArrowRight: () => stepBook(1),
        ArrowUp: () => ride(Math.round(motion.liftTarget) - 1),
        ArrowDown: () => ride(Math.round(motion.liftTarget) + 1),
        PageUp: () => bay(-1),
        PageDown: () => bay(1),
        Home: north,
      };
      const move = moves[e.key];
      if (!move) return;
      e.preventDefault();
      if (intro.current) endIntro();
      move();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [flat, stepBook, ride, bay, north, endIntro, motion]);

  // ---- pointer: drag across to turn, drag up and down to ride ------------
  const grip = useRef({
    id: -1,
    x: 0,
    y: 0,
    lx: 0,
    ly: 0,
    lt: 0,
    axis: "" as "" | "x" | "y",
    caught: false,
    dragged: false,
  });
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button || live.current.reading) return;
    if ((e.target as HTMLElement).closest(".tick")) return;
    if (intro.current) endIntro();
    const g = grip.current;
    g.id = e.pointerId;
    g.x = g.lx = e.clientX;
    g.y = g.ly = e.clientY;
    g.lt = performance.now();
    g.axis = "";
    g.dragged = false;
    g.caught = motion.mode === "coast" || motion.mode === "tween";
    if (g.caught) {
      // Put a hand on the spinning room.
      g.dragged = Math.abs(motion.vel) > 0.8;
      motion.grab();
    }
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    if (g.id !== e.pointerId) return;
    const now = performance.now();
    const D = live.current.dims;
    if (!g.axis) {
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) < 7) return;
      g.axis = Math.abs(dx) >= Math.abs(dy) * 1.15 ? "x" : "y";
      g.dragged = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // The pointer may already be gone.
      }
      root.current?.classList.add("grabbing");
      if (g.axis === "x") motion.grab();
      else {
        if (g.caught) motion.release(now);
        motion.liftHeld = true;
        motion.liftVel = 0;
      }
    }
    const dx = e.clientX - g.lx,
      dy = e.clientY - g.ly;
    if (g.axis === "x") motion.dragBy(-dx / D.R, now);
    else {
      const dt = Math.max(0.004, (now - g.lt) / 1000);
      const dl = -dy / D.pitch;
      motion.lift = clamp(motion.lift + dl, -0.3, 3.3);
      motion.liftVel = motion.liftVel * 0.6 + (dl / dt) * 0.4;
    }
    g.lx = e.clientX;
    g.ly = e.clientY;
    g.lt = now;
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    if (g.id !== e.pointerId) return;
    g.id = -1;
    const now = performance.now();
    root.current?.classList.remove("grabbing");
    if (g.axis === "y") {
      motion.liftHeld = false;
      const fling = now - g.lt > 90 ? 0 : motion.liftVel;
      motion.liftVel = clamp(fling, -6, 6);
      ride(motion.lift + clamp(fling * 0.14, -0.7, 0.7));
    } else motion.release(now);
  };
  useEffect(() => {
    const el = space.current;
    if (!el) return;
    let acc = 0,
      last = 0,
      stepped = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (live.current.reading) return;
      if (intro.current) endIntro();
      const unit = e.deltaMode === 1 ? 32 : 1;
      const dx = (e.deltaX + (e.shiftKey ? e.deltaY : 0)) * unit;
      const dy = (e.shiftKey ? 0 : e.deltaY) * unit;
      if (Math.abs(dx) > Math.abs(dy)) {
        motion.push(clamp(dx * 0.006, -1.4, 1.4));
        return;
      }
      const now = performance.now();
      if (now - last > 260) acc = 0;
      last = now;
      acc += dy;
      if (Math.abs(acc) > 46 && now - stepped > 430) {
        stepped = now;
        ride(Math.round(motion.liftTarget) + Math.sign(acc));
        acc = 0;
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [motion, ride, endIntro, flat]);

  // ---- the loop ----------------------------------------------------------
  useEffect(() => {
    if (flat) return;
    let raf = 0,
      last = performance.now(),
      n = 0,
      skyTime = 0,
      rosa = 0,
      frontEl: HTMLElement | undefined,
      plateId = "",
      saidId = "",
      shownFront = "",
      wasSettled = false,
      lastSkyTurn = NaN,
      lastIris = -1;
    let lastFrameAt = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      lastFrameAt = performance.now();
      tick(now, false);
    };
    const tick = (now: number, forced: boolean) => {
      const dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000));
      last = now;
      n++;
      const L = live.current,
        D = L.dims,
        m = motion;
      const it = intro.current;
      if (it) {
        const t = (now - it.t0) / 1000;
        iris.current = easeInOut(clamp((t - 0.25) / 1.5, 0, 1));
        if (t > 1.05 && it.stage < 1) {
          it.stage = 1;
          setPhase("opening");
        }
        if (t > 1.55 && it.stage < 2) {
          it.stage = 2;
          m.turnTo(it.home, 3100, now);
        }
        if (t > 4.2) {
          intro.current = null;
          setPhase("live");
        }
      }
      m.step(dt, now);

      const tilt = (1.5 - m.lift) * 2.2 - clamp(m.liftVel, -3, 3) * 0.7;
      const shift = D.P * Math.tan((tilt * Math.PI) / 180);
      if (ring.current)
        ring.current.style.transform = `translateZ(${D.R}px) translateY(${(-m.lift * D.pitch).toFixed(2)}px) rotateY(${m.turn.toFixed(5)}rad)`;
      if (cam.current)
        cam.current.style.transform = `rotateX(${tilt.toFixed(3)}deg)`;
      const lookUp = easeInOut(clamp(1 - m.lift, 0, 1));
      const lookDown = easeInOut(clamp(m.lift - 2, 0, 1));
      if (dome.current)
        dome.current.style.transform = `translateY(${(lookUp * D.ow * 0.19).toFixed(1)}px)`;
      if (floor.current)
        floor.current.style.transform = `translateY(${(-lookDown * D.fw * 0.07).toFixed(1)}px)`;

      const speed = Math.min(1, Math.abs(m.vel) / 7);
      if (shaft.current) {
        const chop = speed * 0.8 * (0.5 + 0.5 * Math.sin(m.turn * 31));
        shaft.current.style.transform = `rotate(${(-3 + 5.5 * Math.sin(m.turn * 0.42)).toFixed(2)}deg)`;
        shaft.current.style.opacity = (1 - chop).toFixed(3);
        // Where the shaft meets the floor, a pool of light that sweeps with it.
        if (pool.current) {
          const lean = ((-3 + 5.5 * Math.sin(m.turn * 0.42)) * Math.PI) / 180;
          const x = D.vw * 0.03 - D.vh * 0.84 * Math.sin(lean);
          pool.current.style.transform = `translateX(${x.toFixed(1)}px)`;
          pool.current.style.opacity = (1 - chop).toFixed(3);
        }
      }

      // The tier we stand at and the book straight ahead.
      const a = clamp(Math.round(m.lift), 0, 3);
      if (a !== L.active) {
        L.active = a;
        setActive(a);
      }
      const tier = L.tiers[a];
      if (tier?.books.length) {
        const f = frontOf(tier, m.turn);
        const book = tier.books[f.index];
        const el = registry.current.get(book.id);
        if (el !== frontEl) {
          if (frontEl) delete frontEl.dataset.front;
          if (el) el.dataset.front = "1";
          frontEl = el;
        }
        // Once the room is still, the book ahead slides out and shows its cover.
        const settled =
          m.mode === "idle" &&
          !m.drift &&
          !m.liftHeld &&
          !it &&
          Math.abs(m.lift - m.liftTarget) < 0.03;
        if (settled !== wasSettled) {
          wasSettled = settled;
          root.current?.classList.toggle("settled", settled);
        }
        if (settled && book.id !== shownFront) {
          shownFront = book.id;
          setFrontId(book.id);
        }
        const seen = peek.current ?? book;
        if (seen.id !== plateId && plateTitle.current && plateAuthor.current) {
          plateId = seen.id;
          const at = L.where.get(seen.id);
          plateTitle.current.textContent = at
            ? L.tiers[at.t].arts[at.i].title
            : seen.title;
          plateAuthor.current.textContent = seen.author;
        }
        const heading = headingOf(tier, m.turn);
        // The dock's readout can come and go (it steps matches while a
        // search is on), so it is compared with what it shows, not cached.
        const where = `${f.index + 1} / ${tier.books.length}`;
        if (pos.current && pos.current.textContent !== where)
          pos.current.textContent = where;
        let gap = heading - rosa;
        gap -= Math.round(gap / 360) * 360;
        rosa += gap * Math.min(1, dt * 16);
        if (rose.current)
          rose.current.style.transform = `rotate(${(-rosa).toFixed(2)}deg)`;
        if (
          m.mode === "idle" &&
          !m.drift &&
          !intro.current &&
          book.id !== saidId
        ) {
          saidId = book.id;
          setAnnounce(
            `${tier.focus}, book ${f.index + 1} of ${tier.books.length}: ${tier.arts[f.index].title} by ${book.author}`,
          );
        }
      }
      if (plate.current) {
        const off = a - m.lift;
        const y =
          D.vh / 2 +
          D.cy +
          shift +
          D.H * 0.53 +
          D.lip +
          10 * D.u +
          off * D.pitch;
        plate.current.style.transform = `translate(-50%, ${y.toFixed(1)}px)`;
        plate.current.style.opacity = (
          (1 - clamp(Math.abs(off) * 7, 0, 1)) *
          (1 - clamp(speed * 2.4 - 0.25, 0, 1))
        ).toFixed(2);
      }

      // Build only the arc that faces us.
      const { lo, hi } = tierWindow(D, m.lift);
      const w = L.win;
      if (Math.abs(m.turn - w.c) > 0.13 || lo !== w.lo || hi !== w.hi) {
        L.win = { c: m.turn, lo, hi };
        setWin(L.win);
      }

      // The sky wheels slowly on its own and is dragged by the room.
      if (!L.reduce) skyTime += dt;
      const fast = forced || m.busy || Boolean(it);
      const due = L.reduce
        ? forced || m.turn !== lastSkyTurn || iris.current !== lastIris
        : fast || n % 3 === 0;
      if (due) {
        lastSkyTurn = m.turn;
        lastIris = iris.current;
        sky.current?.draw(
          skyTime * 0.017 + m.turn * 0.35,
          clamp(m.vel * 0.034, -0.7, 0.7),
          iris.current,
          now,
        );
      }
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = lastFrameAt = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const visible = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    };
    // Frames can stop coming: a background tab, a throttled or frozen page.
    // Nothing may be left half-done when they do, so a slow timer notices,
    // drops every transition and carries the room straight to where it was
    // heading. When frames return the motion returns with them.
    const beat = window.setInterval(() => {
      if (document.hidden) return;
      const quiet = performance.now() - lastFrameAt > 1500;
      if (quiet !== stalled.current) {
        stalled.current = quiet;
        root.current?.classList.toggle("stalled", quiet);
      }
      if (!quiet) return;
      if (intro.current) endIntro();
      motion.finish();
      tick(performance.now(), true);
    }, 750);
    start();
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(beat);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [flat, motion]);

  // ---- compass ticks for the matches on this tier ------------------------
  const ticks = useMemo<Tick[]>(() => {
    if (!found) return [];
    const tier = tiers[active];
    const out: Tick[] = [];
    for (const b of found) {
      const at = where.get(b.id);
      if (!at || at.t !== active) continue;
      out.push({
        id: b.id,
        bearing: bearingOfBook(tier, at.i),
        label: `${tier.arts[at.i].title} by ${b.author}`,
      });
      if (out.length >= 90) break;
    }
    return out;
  }, [found, tiers, active, where]);
  const onTick = useCallback(
    (id: string) => {
      const n = live.current.found?.findIndex((b) => b.id === id) ?? -1;
      if (n >= 0) setMatchAt(n);
      face(id);
    },
    [face],
  );
  // ---- markup ------------------------------------------------------------
  const ready = shelf.state === "ok";
  const nothing = Boolean(found && !found.length);
  const pickFocus = (t: number | null) => {
    setParam("focus", t === null ? null : focuses[t]);
    if (t !== null) motion.rideTo(t);
  };

  // The room's own instrument, lent to the shared dock: step the books on
  // this tier, or the matches while a search is on.
  const searchingHits = Boolean(found?.length);
  const matchNo = found?.length ? Math.min(matchAt, found.length - 1) + 1 : 0;
  const step = (by: number) => {
    if (intro.current) endIntro();
    if (searchingHits) stepMatch(by);
    else stepBook(by);
  };
  const instrument = (
    <>
      <button
        type="button"
        className="fx-dock-tool"
        aria-label={searchingHits ? "Previous match" : "Previous book"}
        title={searchingHits ? "Previous match" : "Previous book"}
        disabled={!ready}
        onClick={() => step(-1)}
      >
        <ChevronLeft size={16} strokeWidth={1.6} aria-hidden="true" />
      </button>
      {searchingHits ? (
        <span className="fx-dock-read" role="status">
          <small>Match</small>
          <b>
            {matchNo} of {found!.length}
          </b>
        </span>
      ) : (
        <span className="fx-dock-read" title={focuses[active]}>
          <small>Tier {roman[active]}</small>
          <b ref={pos} />
        </span>
      )}
      <button
        type="button"
        className="fx-dock-tool"
        aria-label={searchingHits ? "Next match" : "Next book"}
        title={searchingHits ? "Next match" : "Next book"}
        disabled={!ready}
        onClick={() => step(1)}
      >
        <ChevronRight size={16} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </>
  );

  const reader = shown && (
    <Reader
      book={shown.book}
      closing={shown.closing}
      origin={origin.current}
      landing={landing}
      still={reduce || flat || stalled.current}
      place={readerPlace}
      onClose={closeBook}
      onClosed={closed}
      onStep={stepReader}
    />
  );
  const emptyCard = nothing && (
    <div className="empty" role="status">
      <b>No book answers to that</b>
      <p>
        Nothing{" "}
        {lit !== null
          ? `on the ${short(focuses[lit])} tier`
          : "on these shelves"}{" "}
        matches “{q.trim()}”.
      </p>
      <div>
        <button type="button" onClick={() => setParam("q", null)}>
          Clear the search
        </button>
        {lit !== null && (
          <button type="button" onClick={() => pickFocus(null)}>
            Search every tier
          </button>
        )}
      </div>
    </div>
  );
  const errorCard = shelf.state === "error" && (
    <div className="empty error" role="alert">
      <b>The room stayed dark</b>
      <p>The shelves could not be loaded just now.</p>
      <div>
        <button type="button" onClick={shelf.reload}>
          Try again
        </button>
      </div>
    </div>
  );

  if (flat)
    return (
      <div className="fx-rotunda flat-mode" ref={root}>
        <div className="flat-scroll" inert={shown ? true : undefined}>
          <header className="flat-head">
            <h1>{site.name}</h1>
          </header>
          {shelf.state === "loading" && (
            <p className="flat-wait">Opening the room</p>
          )}
          {errorCard}
          {emptyCard}
          {ready && (
            <Flat
              tiers={tiers}
              layout={layout}
              lit={lit}
              matches={matches}
              onOpen={openBook}
            />
          )}
        </div>
        {reader}
      </div>
    );

  const sizes = {
    "--u": dims.u,
    "--P": dims.P + "px",
    "--H": dims.H + "px",
    "--ow": dims.ow + "px",
    "--fw": dims.fw + "px",
    "--pitch": dims.pitch + "px",
    "--cy": dims.cy + "px",
    "--cw": dims.coverW + "px",
  } as CSSProperties;

  return (
    <div
      ref={root}
      className={
        "fx-rotunda phase-" +
        phase +
        (entering ? " entering" : "") +
        " as-" +
        layout +
        (shown && !shown.closing ? " reading" : "") +
        (dims.phone ? " phone" : "") +
        (lite || dims.phone ? " lite" : "") +
        (reduce ? " calm" : "") +
        (found ? " searching" : "")
      }
      style={sizes}
    >
      <div
        className="space"
        ref={space}
        inert={shown ? true : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          if (grip.current.dragged) {
            e.stopPropagation();
            e.preventDefault();
            grip.current.dragged = false;
          }
        }}
      >
        <div className="stage" ref={stage}>
          <div className="cam" ref={cam}>
            <div className="ring" ref={ring}>
              {ready && (
                <Ring
                  tiers={tiers}
                  dims={dims}
                  win={win}
                  active={active}
                  lit={lit}
                  matches={matches}
                  outId={shown?.book.id}
                  full={everCovers || layout === "covers"}
                  frontId={frontId}
                  waveAt={waveAt}
                  linger={linger}
                  register={register}
                  onOpen={openBook}
                  onPeek={onPeek}
                />
              )}
            </div>
          </div>
        </div>
        <div className="shade" aria-hidden="true" />
        <div className="shaft-wrap" aria-hidden="true">
          <div className="shaft" ref={shaft} />
        </div>
        <div className="floor" ref={floor}>
          <Compass
            size={dims.fw}
            ticks={ticks}
            current={found?.[matchAt]?.id}
            roseRef={rose}
            onTick={onTick}
            onNorth={north}
          />
          <div className="pool" ref={pool} aria-hidden="true" />
        </div>
        <div className="dome" ref={dome}>
          <Sky ref={sky} width={dims.ow} lite={lite || dims.phone} />
        </div>
        <div className="veil" aria-hidden="true" />
      </div>

      <div className="hud" inert={shown ? true : undefined}>
        <div className="plate" ref={plate} aria-hidden="true">
          <b ref={plateTitle} />
          <span ref={plateAuthor} />
        </div>
        {shelf.state === "loading" && (
          <p className="wait" role="status">
            Opening the room
          </p>
        )}
        {errorCard}
        {emptyCard}
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
      </div>
      {reader}
      <DockSlot>{instrument}</DockSlot>
    </div>
  );
}
