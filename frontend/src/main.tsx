import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, useLocation } from "react-router-dom";
import { ACTIVE, frontends, type Frontend } from "./frontends/registry";
import { sessionMayExist } from "./shared/session";

// "/" wears the active frontend. "/d/<slug>" previews any of them, and
// "/directions" lists them all.
const path = location.pathname.replace(/\/$/, "") || "/";
const previewed = path.match(/^\/d\/([^/]+)/)?.[1];
const chosen =
  path === "/directions"
    ? undefined
    : (frontends.find((f) => f.slug === (previewed ?? ACTIVE)) ??
      frontends.find((f) => f.slug === ACTIVE) ??
      frontends[0]);
const preview = Boolean(previewed && chosen?.slug === previewed);

// lazy() must keep one identity per loader across renders.
const loaded = new Map<Frontend["load"], ReturnType<typeof lazy>>();
function once(load: Frontend["load"]) {
  if (!loaded.has(load)) loaded.set(load, lazy(load));
  return loaded.get(load)!;
}

function Site({ frontend }: { frontend: Frontend }) {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(location.search);
  const Main = once(frontend.load);
  if (!frontend.rooms) return <Main />;
  // A paired frontend: the public page at "/", the owner's rooms elsewhere.
  // A signed-in owner goes straight to the reading room, except in a preview,
  // where "/" always shows the public page so it can be reviewed. "/shelf"
  // shows the public page to anyone.
  if (
    pathname === "/shelf" ||
    (pathname === "/" &&
      (preview ||
        ["pick", "view", "category", "focus", "q"].some((key) =>
          params.has(key),
        ) ||
        !sessionMayExist()))
  )
    return <Main />;
  if (pathname === "/")
    return (
      <Navigate to={{ pathname: "/room", search: location.search }} replace />
    );
  const Rooms = once(frontend.rooms);
  return <Rooms />;
}

const Picker = lazy(() => import("./frontends/picker"));

createRoot(document.getElementById("root")!).render(
  <BrowserRouter basename={preview ? "/d/" + chosen!.slug : "/"}>
    <Suspense fallback={null}>
      {chosen ? <Site frontend={chosen} /> : <Picker />}
    </Suspense>
  </BrowserRouter>,
);
