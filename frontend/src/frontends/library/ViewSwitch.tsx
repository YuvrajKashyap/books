// Moving between views. The dock draws the control; this keeps the rule for
// what carries over: search, category, sort and layout do, an open book
// does not.
import { useSearchParams } from "react-router-dom";
import { readView, views, type ViewSlug } from "./views";

export function useShelfView(): [ViewSlug, (view: ViewSlug) => void] {
  const [params, setParams] = useSearchParams();
  const view = readView(params);
  function setView(next: ViewSlug) {
    if (next === view) return;
    const q = new URLSearchParams(params);
    // An open book belongs to the view it was opened in.
    q.delete("book");
    q.set("view", next);
    setParams(q);
  }
  return [view, setView];
}
