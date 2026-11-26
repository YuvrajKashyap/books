// Every frontend this site can wear. Each lives in its own folder and can be
// removed by deleting that folder and its line here.
import type { ComponentType } from "react";

type Module = Promise<{ default: ComponentType }>;
export type Frontend = {
  slug: string;
  name: string;
  idea: string;
  // The whole site, or only the public main page when `rooms` is set.
  load: () => Module;
  // The signed-in rooms this frontend pairs with.
  rooms?: () => Module;
};

const rooms = () => import("./rooms");

export const frontends: Frontend[] = [
  {
    slug: "current",
    name: "Current",
    idea: "The oak shelf and night study as they were before the directions.",
    load: () => import("./current"),
  },
  {
    slug: "library",
    name: "Library",
    idea: "One shelf with three views: a lamplit study, a rotunda, and gravity.",
    load: () => import("./library"),
    rooms,
  },
];

// The one switch. Change this slug, or set VITE_FRONTEND at build time, to
// change which frontend the live site wears.
export const ACTIVE: string = import.meta.env.VITE_FRONTEND ?? "library";
