// The owner's side for every frontend: the session, the private library and
// every change to it. No presentation lives here. Call useOwner() once, at
// the root of the owner rooms.
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import {
  backupSchema,
  initialView,
  viewSchema,
  type Book,
  type Library,
  type View,
} from "../../../shared/model";

export {
  columns,
  completed,
  focuses,
  freshBook,
  initialView,
  nextPick,
  queue,
  statuses,
} from "../../../shared/model";
export type { Book, Library, View };
export type Backup = ReturnType<typeof backupSchema.parse>;
export type BookFields = Omit<Book, "id" | "queuePosition" | "history">;

// Every change the backend accepts. Each resolves true once it is saved.
export type Action =
  | { op: "save"; id?: string; book: BookFields } // omit id to add a book
  | { op: "remove"; id: string }
  | { op: "move"; id: string; target: string } // reorder within one queue
  | { op: "shelfMove"; id: string; target: string } // reorder on the shelf
  | { op: "rotation"; rotation: number } // 0, 1 or 2: next category
  | { op: "view"; view: View } // save or replace a named view
  | { op: "removeView"; name: string }
  | { op: "restore"; backup: Backup };
export type Mutate = (action: Action) => Promise<boolean>;

function download(data: unknown, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function useOwner() {
  const [auth, setAuth] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [library, setLibrary] = useState<Library | null>(null),
    [message, setMessage] = useState(""),
    [issue, setIssue] = useState(""),
    [saving, setSaving] = useState(false);
  const subject = useRef<string | undefined>(undefined);
  const lock = useRef(false);

  useEffect(() => {
    let unsubscribe = () => {},
      active = true;
    (async () => {
      try {
        const [r, { createClient }] = await Promise.all([
          fetch("/api/config"),
          import("@supabase/supabase-js"),
        ]);
        if (!r.ok) throw Error();
        const cfg = await r.json();
        const client = createClient(cfg.url, cfg.key, {
          auth: { detectSessionInUrl: false },
        });
        if (!active) return;
        setAuth(client);
        const sub = client.auth.onAuthStateChange((_e, s) => {
          if (!active) return;
          if (subject.current !== s?.user.id) {
            subject.current = s?.user.id;
            setLibrary(null);
            setIssue("");
          }
          setSession(s);
          setReady(true);
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
    setLibrary((current) =>
      current && current.revision > snapshot.revision ? current : snapshot,
    );
    setIssue("");
  }, [request, session?.user.id]);

  useEffect(() => {
    if (ready && session) refresh().catch((e) => setIssue(e.message));
  }, [ready, refresh]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4200);
    return () => clearTimeout(t);
  }, [message]);

  const mutate: Mutate = async (action) => {
    if (lock.current || !library) return false;
    lock.current = true;
    setSaving(true);
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
      if (result.library)
        setLibrary((current) =>
          current && current.revision > result.library.revision
            ? current
            : result.library,
        );
      else await refresh();
      setMessage("Library updated");
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  // Resolves "" once signed in, or the sentence to show the person.
  async function signIn(username: string, password: string) {
    if (!auth) return "Sign-in is still connecting. Try again in a moment.";
    try {
      username = username.trim();
      if (username.includes("@")) {
        const result = await auth.auth.signInWithPassword({
          email: username,
          password,
        });
        return result.error ? "Could not sign in with those details." : "";
      }
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok)
        return response.status === 429
          ? "Too many attempts. Try again later."
          : response.status >= 500
            ? "Sign-in is unavailable. Try again shortly."
            : "Could not sign in with those details.";
      const result = await auth.auth.setSession(await response.json());
      return result.error ? "Could not open the session. Try again." : "";
    } catch {
      return "Unable to reach sign-in. Try again.";
    }
  }

  return {
    // False until the stored session has been checked. Show a loading state.
    ready,
    // True while the sign-in form can be submitted.
    canSignIn: Boolean(auth),
    signedIn: Boolean(session),
    // The private library. Null while loading, signed out, or not allowed.
    library,
    // True from sign-in until the library arrives.
    loading: Boolean(session && !library && !issue),
    // A lasting problem to show in place of the library.
    issue,
    // A short notice after a change ("Library updated" or the error). Clears
    // itself after a few seconds.
    message,
    notify: setMessage,
    // True while a change is being saved; further changes are ignored.
    saving,
    signIn,
    // Signs out on this device only.
    signOut: async () => {
      try {
        if (!auth) return false;
        const { error } = await auth.auth.signOut({ scope: "local" });
        if (error) throw error;
        return true;
      } catch {
        setMessage("Could not sign out. Please try again.");
        return false;
      }
    },
    mutate,
    exportLibrary: () => {
      if (library) download(library, "yuvraj-bookshelf.json");
    },
    // The Notion database exactly as it was imported.
    exportArchive: async () => {
      try {
        const r = await request("archive");
        if (!r.ok) throw Error();
        download(await r.json(), "notion-source.json");
      } catch {
        setMessage("Archive download failed. Please retry.");
      }
    },
  };
}
export type Owner = ReturnType<typeof useOwner>;

// Reads a backup file. Null when it is not a valid bookshelf backup. Restore
// it with mutate({ op: "restore", backup }) only after the owner confirms.
export async function readBackup(file: File): Promise<Backup | null> {
  try {
    return backupSchema.parse(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}

// The collection's current view lives in the address, so it can be shared and
// survives a reload. Only differences from the default view are written.
export function useView(): [View, (view: View) => void] {
  const [params, setParams] = useSearchParams();
  const parsed = viewSchema.safeParse({
    ...initialView,
    ...Object.fromEntries(params),
    hidden: params.has("hidden")
      ? params.get("hidden")!.split(",").filter(Boolean)
      : initialView.hidden,
  });
  const view = parsed.success ? parsed.data : initialView;
  function setView(next: View) {
    const q = new URLSearchParams();
    const book = params.get("book");
    if (book) q.set("book", book);
    for (const [k, value] of Object.entries(next)) {
      if (
        JSON.stringify(value) !== JSON.stringify(initialView[k as keyof View])
      )
        q.set(k, Array.isArray(value) ? value.join(",") : String(value));
    }
    setParams(q, { replace: true });
  }
  return [view, setView];
}
