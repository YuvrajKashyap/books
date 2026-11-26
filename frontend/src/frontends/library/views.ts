// The ways to look at the one shelf. Each is a full public page in its own
// folder under views/. The address keeps the choice in `view`.
import type { ComponentType } from "react";

export type ViewSlug = "lamp" | "rotunda" | "gravity";
export const views: {
  slug: ViewSlug;
  name: string;
  hint: string;
  load: () => Promise<{ default: ComponentType }>;
}[] = [
  {
    slug: "lamp",
    name: "Study",
    hint: "A walnut case under one lamp",
    load: () => import("./views/lamp"),
  },
  {
    slug: "rotunda",
    name: "Rotunda",
    hint: "A round library you turn",
    load: () => import("./views/rotunda"),
  },
  {
    slug: "gravity",
    name: "Gravity",
    hint: "Shelves of light on bent space",
    load: () => import("./views/gravity"),
  },
];
export const firstView: ViewSlug = "lamp";
const remembered = "books-view";

export function readView(params: URLSearchParams): ViewSlug {
  const asked = params.get("view");
  const known = (slug: string | null) => views.find((v) => v.slug === slug);
  if (known(asked)) return asked as ViewSlug;
  try {
    const last = localStorage.getItem(remembered);
    if (known(last)) return last as ViewSlug;
  } catch {
    // Storage can be unavailable; the first view is a fine answer.
  }
  return firstView;
}
export function rememberView(view: ViewSlug) {
  try {
    localStorage.setItem(remembered, view);
  } catch {
    // Nothing to do: the address still carries the choice.
  }
}
