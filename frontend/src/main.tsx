import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { PublicShelf } from "./PublicShelf";
import { Brand } from "./components";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./style.css";
import "./shelf/room.css";

const OwnerApp = lazy(() => import("./OwnerApp"));

function sessionMayExist() {
  try {
    return Object.keys(localStorage).some(key => /^sb-.+-auth-token$/.test(key));
  } catch {
    return true;
  }
}

function Entry() {
  const { pathname } = useLocation();
  const [owner, setOwner] = useState(sessionMayExist);
  const ownerRoute = pathname !== "/";
  useEffect(() => {
    if (ownerRoute) setOwner(true);
    const changed = () => { if (sessionMayExist()) setOwner(true); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [ownerRoute]);
  if (!owner && !ownerRoute) return <PublicShelf />;
  return <Suspense fallback={<div className="loading"><Brand /><p>Opening the reading room…</p></div>}><OwnerApp /></Suspense>;
}

createRoot(document.getElementById("root")!).render(<BrowserRouter><Entry /></BrowserRouter>);
