import { useCallback, useEffect, useRef, useState } from "react";
import {
  NavLink,
  useLocation,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import {
  Plus,
  BookOpen,
  LockKeyhole,
  ArrowRight,
  LibraryBig,
  Repeat2,
  History,
  Settings2,
  Download,
  LogOut,
  Upload,
} from "lucide-react";
import { Brand, Dialog } from "./components";
import "./owner-desk.css";
import { ScienceStudy } from "./shelf/ScienceStudy";
import { Feature, Queues, Timeline, type Mutate } from "./Reading";
import { PublicShelf } from "./PublicShelf";
import { Collection } from "./Collection";
import { Editor } from "./Editor";
import {
  backupSchema,
  initialView,
  viewSchema,
  type View,
  type Library,
} from "../../shared/model";
const nav = [
  { path: "/", label: "Reading room", icon: BookOpen },
  { path: "/collection", label: "Collection", icon: LibraryBig },
  { path: "/queues", label: "Queues", icon: Repeat2 },
  { path: "/history", label: "History", icon: History },
];
function Gate({ auth, issue }: { auth: SupabaseClient | null; issue: string }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="gate">
      <div className="gate-intro">
        <Brand />
        <div>
          <span className="kicker">Private library</span>
          <h1>
            The reading
            <br />
            <i>room.</i>
          </h1>
          <div className="gate-rule" />
          <p>Yuvraj Kashyap’s personal collection</p>
        </div>

      </div>
      <div className="gate-form">
        <a href="/">← Back to the shelf</a>
        <p>
          <LockKeyhole size={22} />
        </p>
        <h2>Open your library</h2>
        <p>Sign in to manage your collection.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!auth) return;
            const fd = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const { error } = await auth.auth.signInWithPassword({
                email: String(fd.get("email")),
                password: String(fd.get("password")),
              });
              if (error) setError(error.message);
            } catch {
              setError("Unable to reach sign-in. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="primary" disabled={!auth || busy}>
            {busy ? "Opening…" : "Enter reading room"}
            <ArrowRight size={16} />
          </button>
        </form>
        {(error || issue) && <p role="alert">{error || issue}</p>}
      </div>
    </div>
  );
}
function download(data: unknown, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export default function OwnerApp() {
  const [auth, setAuth] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [library, setLibrary] = useState<Library | null>(null),
    [msg, setMsg] = useState(""),
    [issue, setIssue] = useState(""),
    [settings, setSettings] = useState(false),
    [restore, setRestore] = useState<ReturnType<
      typeof backupSchema.parse
    > | null>(null);
  const subject = useRef<string | undefined>(undefined);
  const lock = useRef(false),
    [params, setParams] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate();
  const viewParsed = viewSchema.safeParse({
    ...initialView,
    ...Object.fromEntries(params),
    hidden: params.has("hidden")
      ? params.get("hidden")!.split(",").filter(Boolean)
      : initialView.hidden,
  });
  const view = viewParsed.success ? viewParsed.data : initialView;
  const edit = params.get("book");
  function open(id: string) {
    const q = new URLSearchParams(params);
    q.set("book", id);
    setParams(q, { state: { fromLibrary: true } });
  }
  function close() {
    if (location.state?.fromLibrary) navigate(-1);
    else {
      const q = new URLSearchParams(params);
      q.delete("book");
      setParams(q, { replace: true });
    }
  }
  function setView(v: View) {
    const q = new URLSearchParams();
    for (const [k, value] of Object.entries(v)) {
      if (
        JSON.stringify(value) !== JSON.stringify(initialView[k as keyof View])
      )
        q.set(k, Array.isArray(value) ? value.join(",") : String(value));
    }
    setParams(q, { replace: true });
  }
  useEffect(() => {
    let unsubscribe = () => {},
      active = true;
    (async () => {
      try {
        const r = await fetch("/api/config");
        if (!r.ok) throw Error();
        const cfg = await r.json();
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(cfg.url, cfg.key);
        if (!active) return;
        setAuth(client);
        const sub = client.auth.onAuthStateChange((_e, s) => {
          if (active) {
            if (subject.current !== s?.user.id) {
              subject.current = s?.user.id;
              setLibrary(null);
              setSettings(false);
              setRestore(null);
              setIssue("");
            }
            setSession(s);
            setReady(true);
          }
        });
        unsubscribe = () => sub.data.subscription.unsubscribe();
      } catch {
        if (active) {
          setIssue("Could not connect to authentication. Refresh to retry.");
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const request = useCallback(
    async (path: string, init: RequestInit = {}) =>
      fetch("/api/" + path, {
        ...init,
        headers: {
          ...(session
            ? { Authorization: "Bearer " + session.access_token }
            : {}),
          "Content-Type": "application/json",
          ...init.headers,
        },
      }),
    [session?.access_token],
  );
  const refresh = useCallback(async () => {
    const r = await request("library");
    if (subject.current !== session?.user.id) return;
    if (r.status === 401) {
      setLibrary(null);
      if (session) setIssue("This account does not have access to Books.");
      return;
    }
    if (!r.ok)
      throw Error("Your library could not be loaded. Refresh to retry.");
    const snapshot = await r.json();
    if (subject.current !== session?.user.id) return;
    setLibrary(current => current && current.revision > snapshot.revision ? current : snapshot);
    setIssue("");
  }, [request, session?.user.id]);
  useEffect(() => {
    if (ready && session) refresh().catch((e) => setIssue(e.message));
  }, [ready, refresh]);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 4200);
    return () => clearTimeout(t);
  }, [msg]);
  const mutate: Mutate = async (action) => {
    if (lock.current || !library) return false;
    lock.current = true;
    try {
      const r = await request("command", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ revision: library.revision, action }),
      });
      if (!r.ok) {
        if (r.status === 409) await refresh();
        throw Error((await r.json()).error || "Save failed.");
      }
      const result = await r.json();
      if (subject.current !== session?.user.id) return false;
      if (result.library) setLibrary(current => current && current.revision > result.library.revision ? current : result.library);
      else await refresh();
      setMsg("Library updated");
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed.");
      return false;
    } finally {
      lock.current = false;
    }
  };
  const ownerRoute = ["/admin", "/collection", "/queues", "/history"].includes(location.pathname);
  if ((!ready && ownerRoute) || (session && !library && !issue))
    return (
      <div className="loading">
        <Brand />
        <p>Opening the reading room…</p>
      </div>
    );
  if (!session && !ownerRoute)
    return <PublicShelf />;
  if (!library || !session)
    return (
      <>
        <Gate auth={auth} issue={issue} />
        {session && (
          <button
            className="switch"
            onClick={() => auth?.auth.signOut({ scope: "local" })}
          >
            Switch account
          </button>
        )}
      </>
    );
  const page =
    location.pathname === "/collection"
      ? "collection"
      : location.pathname === "/queues"
        ? "queue"
        : location.pathname === "/history"
          ? "history"
          : "room";
  const selected = library.books.find((b) => b.id === edit);
  const shelfPage = (page === "room" || page === "collection") && view.layout !== "table";
  return (
    <div className="private-room">
      <header className={`library-heading owner-heading${shelfPage ? " shelf-page" : ""}`}>
        <div className="mast">
          <NavLink to="/" className="brand-link">
            <Brand />
          </NavLink>
          
          <nav>
            {nav.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} end to={path}>
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>
          <button className="primary" onClick={() => open("new")}>
            <Plus size={17} />
            Add book
          </button>
          <button
            className="avatar"
            aria-label="Library settings"
            onClick={() => setSettings(true)}
          >
            YK
          </button>
        </div>
        <div className="page-title library-heading-inner">
          <div>
            <h1>
              {page === "room"
                ? "Reading room"
                : page === "collection"
                  ? "The collection"
                  : page === "queue"
                    ? "Reading queues"
                    : "Reading history"}
            </h1>
          </div>
          <ScienceStudy />
        </div>
      </header>
      <main className={`reading-desk${shelfPage ? " shelf-page" : ""}`}>
        {page === "room" || page === "collection" ? (
          <>
            <Collection
              mutate={mutate}
              books={library.books}
              view={view}
              setView={setView}
              views={library.views}
              open={open}
            />
            {page === "room" && <Feature library={library} open={open} />}
          </>
        ) : page === "queue" ? (
          <Queues library={library} mutate={mutate} open={open} />
        ) : (
          <Timeline books={library.books} open={open} />
        )}
      </main>
      {edit &&
        (edit === "new" || selected ? (
          <Editor key={edit} book={selected} mutate={mutate} onClose={close} />
        ) : (
          <Dialog title="Book unavailable" onClose={close}>
            <p>This book is no longer in the library.</p>
          </Dialog>
        ))}
      {settings && (
        <Dialog
          title="Library settings"
          onClose={() => {
            setSettings(false);
            setRestore(null);
          }}
        >
          <div className="setting-intro">
            <Settings2 />
            <div>
              <strong>Yuvraj’s private library</strong>
              <small>
                {library.books.length} books · {library.views.length} saved
                views
              </small>
            </div>
          </div>
          <button
            className="setting"
            onClick={() => download(library, "yuvraj-bookshelf.json")}
          >
            <Download />
            Export library
          </button>
          <button
            className="setting"
            onClick={async () => {
              try {
                const r = await request("archive");
                if (!r.ok) throw Error();
                download(await r.json(), "notion-source.json");
              } catch {
                setMsg("Archive download failed. Please retry.");
              }
            }}
          >
            <Download />
            Export original Notion archive
          </button>
          <label className="setting">
            <Upload />
            Restore library backup
            <input
              type="file"
              accept=".json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setRestore(backupSchema.parse(JSON.parse(await file.text())));
                } catch {
                  setMsg("Choose a valid bookshelf JSON backup.");
                }
                e.target.value = "";
              }}
            />
          </label>
          {restore && (
            <div className="confirm">
              Replace the library with {restore.books.length} books?
              <button
                onClick={async () => {
                  if (await mutate({ op: "restore", backup: restore }))
                    setRestore(null);
                }}
              >
                Restore backup
              </button>
              <button onClick={() => setRestore(null)}>Cancel</button>
            </div>
          )}
          <button
            className="setting"
            onClick={async () => {
              await auth?.auth.signOut({ scope: "local" });
              setSettings(false);
              setLibrary(null);
            }}
          >
            <LogOut />
            Sign out
          </button>
        </Dialog>
      )}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </div>
  );
}
