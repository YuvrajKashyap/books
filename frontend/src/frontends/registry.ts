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
    slug: "gravity",
    name: "Gravity Well",
    idea: "The library floats on a sheet of spacetime that every book bends.",
    load: () => import("./gravity"),
    rooms,
  },
  {
    slug: "lamplit",
    name: "One Lamp",
    idea: "A dark study lit by a single hanging filament you can swing.",
    load: () => import("./lamplit"),
    rooms,
  },
  {
    slug: "spectrum",
    name: "Spectrum",
    idea: "White light crosses a prism and fans out into four shelves.",
    load: () => import("./spectrum"),
    rooms,
  },
  {
    slug: "rotunda",
    name: "Rotunda",
    idea: "You stand in a round library and turn the shelves around you.",
    load: () => import("./rotunda"),
    rooms,
  },
  {
    slug: "draft",
    name: "The Drawing",
    idea: "An inked survey of the shelf that your light develops into colour.",
    load: () => import("./draft"),
    rooms,
  },
];

// The one switch. Change this slug, or set VITE_FRONTEND at build time, to
// change which frontend the live site wears.
export const ACTIVE: string = import.meta.env.VITE_FRONTEND ?? "current";
