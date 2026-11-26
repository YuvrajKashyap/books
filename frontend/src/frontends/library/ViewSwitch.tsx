// The control that moves between views. It carries no look of its own: each
// view places it in its own controls and styles `.view-switch` to match.
import { useSearchParams } from "react-router-dom";
import { Lamp, Orbit, Rotate3d } from "lucide-react";
import { firstView, readView, views, type ViewSlug } from "./views";

const icons = { lamp: Lamp, rotunda: Rotate3d, gravity: Orbit };

export function useShelfView(): [ViewSlug, (view: ViewSlug) => void] {
  const [params, setParams] = useSearchParams();
  const view = readView(params);
  function setView(next: ViewSlug) {
    if (next === view) return;
    const q = new URLSearchParams(params);
    // Layout names differ between views, and an open book belongs to the
    // view it was opened in. Search, category and sort carry over.
    q.delete("layout");
    q.delete("book");
    if (next === firstView) q.delete("view");
    else q.set("view", next);
    setParams(q);
  }
  return [view, setView];
}

export function ViewSwitch({ className = "" }: { className?: string }) {
  const [view, setView] = useShelfView();
  return (
    <div
      className={"view-switch " + className}
      role="group"
      aria-label="Shelf view"
    >
      {views.map((v) => {
        const Icon = icons[v.slug];
        return (
          <button
            key={v.slug}
            type="button"
            data-view={v.slug}
            aria-pressed={v.slug === view}
            title={v.hint}
            onClick={() => setView(v.slug)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{v.name}</span>
          </button>
        );
      })}
    </div>
  );
}
