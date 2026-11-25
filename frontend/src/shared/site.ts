// Facts about the site that every frontend states the same way.
import { useEffect } from "react";
export const site = {
  name: "Yuvraj’s Bookshelf",
  owner: "Yuvraj Kashyap",
  monogram: "YK",
  description:
    "Explore Yuvraj Kashyap’s personal book collection by title, author, and category.",
  rotation: "Identity → Wealth → Behavior",
};
export function useTitle(part?: string) {
  useEffect(() => {
    document.title =
      (part ? part + " · " : "") + site.name + " · " + site.owner;
  }, [part]);
}
