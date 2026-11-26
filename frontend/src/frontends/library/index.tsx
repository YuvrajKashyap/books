// One shelf, three ways to stand in front of it. This shell picks the view
// from the address and hands one room over to the next: the old room goes
// out the way it lives (the lamp to an ember, the rotunda up into its
// oculus, gravity down into a point) and the new one opens the way it lives.
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useSearchParams } from "react-router-dom";
import { readView, rememberView, views, type ViewSlug } from "./views";
import "./library.css";

const loaded = new Map<ViewSlug, ComponentType>();
function viewComponent(slug: ViewSlug) {
  if (!loaded.has(slug))
    loaded.set(slug, lazy(views.find((v) => v.slug === slug)!.load));
  return loaded.get(slug)!;
}
const close = 280; // ms for the old room to go out; the opening takes ~420

export default function Library() {
  const [params] = useSearchParams();
  const asked = readView(params);
  const [shown, setShown] = useState(asked);
  const [dark, setDark] = useState(false);
  // Where the dark gathers: the room going out, then the room coming in.
  const [at, setAt] = useState(asked);
  const timer = useRef(0);

  useEffect(() => {
    rememberView(asked);
    if (asked === shown) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      setShown(asked);
      setAt(asked);
      return;
    }
    setAt(shown);
    setDark(true);
    // Fetch the next view while the room is going dark.
    void views.find((v) => v.slug === asked)!.load();
    timer.current = window.setTimeout(() => {
      setAt(asked);
      setShown(asked);
      window.scrollTo(0, 0);
    }, close);
    return () => clearTimeout(timer.current);
  }, [asked, shown]);

  const View = viewComponent(shown);
  return (
    <>
      <Suspense fallback={null}>
        <View key={shown} />
        <Lift onReady={() => setDark(false)} view={shown} />
      </Suspense>
      <div
        className={"fx-library-veil" + (dark ? " is-dark" : "")}
        data-at={at}
        aria-hidden="true"
      >
        <i className="fx-library-mark" data-next={asked} />
      </div>
    </>
  );
}

// Mounts only once the view above it has loaded, then lifts the dark.
function Lift({ onReady, view }: { onReady: () => void; view: ViewSlug }) {
  useEffect(() => {
    const id = window.setTimeout(onReady, 70);
    return () => clearTimeout(id);
  }, [view]);
  return null;
}
