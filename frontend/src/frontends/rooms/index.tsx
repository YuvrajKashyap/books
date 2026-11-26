// The owner's rooms: a private study at night. One lamp, brass markings,
// paper wherever there is writing. This file is the door and the frame;
// each room has its own file.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./base.css";
import "./rooms.css";
import "./sheet.css";

import { useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useNavigationType,
} from "react-router-dom";
import {
  BookOpen,
  Clock3,
  LayoutGrid,
  ListOrdered,
  Plus,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useOwner, type Owner } from "../../shared/owner";
import { site } from "../../shared/site";
import { Field } from "./Field";
import { Gate, Loading } from "./Gate";
import { ReadingRoom } from "./ReadingRoom";
import { Collection } from "./Collection";
import { Queues } from "./Queues";
import { History } from "./History";
import { Editor } from "./Editor";
import { Settings } from "./Settings";
import {
  RoomsContext,
  cx,
  useBookParam,
  useReducedMotion,
  type Rooms as RoomsValue,
} from "./util";

const rooms: { path: string; name: string; short: string; icon: LucideIcon }[] =
  [
    { path: "/room", name: "Reading room", short: "Room", icon: BookOpen },
    {
      path: "/collection",
      name: "Collection",
      short: "Shelves",
      icon: LayoutGrid,
    },
    { path: "/queues", name: "Queues", short: "Queues", icon: ListOrdered },
    { path: "/history", name: "History", short: "History", icon: Clock3 },
  ];

// True when this browser appears to hold a session. Read-only.
function likelySession() {
  try {
    for (let i = 0; i < localStorage.length; i++)
      if (/^sb-.+-auth-token/.test(localStorage.key(i) ?? "")) return true;
  } catch {
    return true;
  }
  return false;
}

export default function Rooms() {
  const owner = useOwner();
  const reduced = useReducedMotion();
  const location = useLocation();
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const room = rooms.find((r) => r.path === path);

  if (!room && path !== "/admin") return <Navigate to="/" replace />;

  let scene;
  if (!owner.ready)
    // With no stored session the form is shown at once; sign-in enables
    // itself when the connection is ready.
    scene = likelySession() ? (
      <Loading label="Finding the light" />
    ) : (
      <Gate owner={owner} reduced={reduced} />
    );
  else if (!owner.signedIn) scene = <Gate owner={owner} reduced={reduced} />;
  else if (!owner.library)
    scene = owner.loading ? (
      <Loading label="Opening the library" />
    ) : (
      <Gate owner={owner} reduced={reduced} />
    );
  else if (!room) return <Navigate to="/room" replace />;
  else scene = <Shell owner={owner} path={room.path} reduced={reduced} />;

  return (
    <div className="fx-rooms">
      {scene}
      <div className="toast-zone" role="status" aria-live="polite">
        {owner.message && (
          <p className="toast" key={owner.message}>
            <i aria-hidden="true" />
            {owner.message}
          </p>
        )}
      </div>
    </div>
  );
}

function Shell({
  owner,
  path,
  reduced,
}: {
  owner: Owner;
  path: string;
  reduced: boolean;
}) {
  const library = owner.library!;
  const sheet = useBookParam();
  const [settings, setSettings] = useState(false);
  // The browser's Back button would close the editor and lose what was
  // typed. While it has unsaved changes, Back keeps the sheet, steps forward
  // again, and the editor asks first, as its own Cancel does.
  const navigate = useNavigate();
  const navType = useNavigationType();
  const unsaved = useRef(false);
  const kept = useRef<string | null>(null);
  const [backed, setBacked] = useState(0);
  const heldBack =
    !sheet.id && kept.current !== null && unsaved.current && navType === "POP";
  const sheetId = heldBack ? kept.current : sheet.id;
  kept.current = sheetId;
  useEffect(() => {
    if (!heldBack) return;
    navigate(1);
    setBacked((n) => n + 1);
  }, [heldBack]);
  function closeSheet() {
    unsaved.current = false;
    kept.current = null;
    setBacked(0);
    sheet.close();
  }
  const value: RoomsValue = { owner, library, open: sheet.open, reduced };

  // A new room starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  return (
    <RoomsContext.Provider value={value}>
      <Field mode="room" reduced={reduced} />
      <div className="vignette" aria-hidden="true" />
      <a className="skip" href="#room-main">
        Skip to the room
      </a>

      <header className="mast">
        <Link
          to="/room"
          className="mast-name"
          aria-label={site.name + ", reading room"}
        >
          <span className="seal">{site.monogram}</span>
          <span className="mast-words">
            <b>{site.name}</b>
            <small>private reading room</small>
          </span>
        </Link>
        <nav className="mast-nav" aria-label="Rooms">
          {rooms.map((r) => (
            <Link
              key={r.path}
              to={r.path}
              className={cx("mast-link", r.path === path && "is-here")}
              aria-current={r.path === path ? "page" : undefined}
            >
              <r.icon size={18} aria-hidden="true" />
              <span className="mast-long">{r.name}</span>
              <span className="mast-short">{r.short}</span>
            </Link>
          ))}
        </nav>
        <div className="mast-tools">
          <Link to="/shelf" className="mast-public">
            View public shelf
          </Link>
          <button
            type="button"
            className="btn btn-brass mast-add"
            onClick={() => sheet.open("new")}
          >
            <Plus size={17} aria-hidden="true" />
            <span>Add book</span>
          </button>
          <button
            type="button"
            className="btn btn-round"
            aria-label="Settings"
            aria-haspopup="dialog"
            onClick={() => setSettings(true)}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
          </button>
        </div>
        <span className="mast-rule" aria-hidden="true" />
      </header>

      {owner.issue && (
        <p className="issue-bar" role="alert">
          {owner.issue}
        </p>
      )}

      <main id="room-main" className="page" key={path} tabIndex={-1}>
        {path === "/room" && <ReadingRoom />}
        {path === "/collection" && <Collection />}
        {path === "/queues" && <Queues />}
        {path === "/history" && <History />}
      </main>

      {sheetId && (
        <Editor
          key={sheetId}
          id={sheetId}
          onClose={closeSheet}
          onDirty={(v) => (unsaved.current = v)}
          asked={backed}
        />
      )}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </RoomsContext.Provider>
  );
}
