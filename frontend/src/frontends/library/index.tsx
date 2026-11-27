// One shelf, three ways to stand in front of it. This shell picks the view
// from the address and hands one room over to the next: the old room goes
// out the way it lives (the lamp to an ember, the rotunda up into its
// oculus, gravity down into a point) and the new one opens the way it lives.
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import {
  canonicalShelfParams,
  readView,
  rememberView,
  views,
  type ViewSlug,
} from "./views";
import { reloadOnStale } from "../../shared/reloadOnStale";
import { Dock, DockSlotProvider } from "./Dock";
import "./library.css";

const loaded = new Map<ViewSlug, ComponentType>();
function viewComponent(slug: ViewSlug) {
  if (!loaded.has(slug))
    loaded.set(
      slug,
      lazy(reloadOnStale(views.find((v) => v.slug === slug)!.load)),
    );
  return loaded.get(slug)!;
}
const close = 280; // ms for the old room to go out; the opening takes ~420

export default function Library() {
  const location = useLocation();
  const [params] = useSearchParams();
  const canonical = canonicalShelfParams(params);
  if (canonical.toString() !== params.toString())
    return (
      <Navigate
        replace
        state={location.state}
        to={{
          pathname: location.pathname,
          search: canonical.toString(),
          hash: location.hash,
        }}
      />
    );
  return <ShelfRoom asked={readView(params)} />;
}

function ShelfRoom({ asked }: { asked: ViewSlug }) {
  const [shown, setShown] = useState(asked);
  const [ready, setReady] = useState(asked);
  const dark = asked !== shown || ready !== shown;

  useEffect(() => {
    rememberView(asked);
    if (asked === shown) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      setShown(asked);
      return;
    }
    // Fetch the next view while the room is going dark.
    void views
      .find((v) => v.slug === asked)!
      .load()
      .catch(() => {});
    const timer = window.setTimeout(() => {
      setShown(asked);
      window.scrollTo(0, 0);
    }, close);
    return () => clearTimeout(timer);
  }, [asked, shown]);

  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const View = viewComponent(shown);
  return (
    <DockSlotProvider slot={slot}>
      <Suspense fallback={null}>
        <View key={shown} />
        <Lift onReady={setReady} view={shown} />
      </Suspense>
      <Dock skin={asked} onSlot={setSlot} />
      <div
        className={"fx-library-veil" + (dark ? " is-dark" : "")}
        data-at={shown}
        aria-hidden="true"
      >
        <i className="fx-library-mark" data-next={asked} />
      </div>
    </DockSlotProvider>
  );
}

// Mounts only once the view above it has loaded, then lifts the dark.
function Lift({
  onReady,
  view,
}: {
  onReady: (view: ViewSlug) => void;
  view: ViewSlug;
}) {
  useEffect(() => {
    const id = window.setTimeout(() => onReady(view), 70);
    return () => clearTimeout(id);
  }, [view, onReady]);
  return null;
}
