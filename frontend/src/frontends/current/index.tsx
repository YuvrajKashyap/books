// The frontend as it stood before the directions were explored. Kept whole.
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PublicShelf } from "./PublicShelf";
import { Brand } from "./components";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "./tokens.css";
import "./style.css";
import "./shelf/room.css";
import "./library.css";
import { sessionMayExist } from "../../shared/session";

const OwnerApp = lazy(() => import("./OwnerApp"));
const measureSynopsis =
  location.pathname === "/" &&
  new URLSearchParams(location.search).get("measure") === "synopsis";
if (measureSynopsis)
  void import("./shelf/measureSynopsis").then((probe) => probe.measure());

export default function Current() {
  const { pathname } = useLocation();
  const [owner, setOwner] = useState(sessionMayExist);
  const ownerRoute = pathname !== "/";
  useEffect(() => {
    if (ownerRoute) setOwner(true);
    const changed = () => {
      if (sessionMayExist()) setOwner(true);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [ownerRoute]);
  if (!ownerRoute && (!owner || measureSynopsis)) return <PublicShelf />;
  return (
    <Suspense
      fallback={
        <div className="loading">
          <Brand />
          <p>Opening the reading room…</p>
        </div>
      }
    >
      <OwnerApp />
    </Suspense>
  );
}
