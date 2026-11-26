// The door to the study. The room is dark; one light finds the form.
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, LoaderCircle } from "lucide-react";
import type { Owner } from "../../shared/owner";
import { site, useTitle } from "../../shared/site";
import { Field } from "./Field";
import { Filament } from "./Instruments";

export function Gate({ owner, reduced }: { owner: Owner; reduced: boolean }) {
  useTitle("Sign in");
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState("yuvraj");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Signed in, but this account cannot read the library.
  const locked = owner.signedIn && Boolean(owner.issue);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !owner.canSignIn) return;
    setBusy(true);
    setError("");
    const problem = await owner.signIn(username, password);
    setBusy(false);
    if (problem) setError(problem);
    else setPassword("");
  }

  return (
    <div className="gate" ref={root}>
      <Field
        mode="gate"
        reduced={reduced}
        home={() => {
          const box = card.current?.getBoundingClientRect();
          return box
            ? { x: box.left + box.width / 2, y: box.top + box.height * 0.46 }
            : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        }}
        onLight={(x, y, warmth) => {
          const el = root.current;
          if (!el) return;
          el.style.setProperty("--lx", x.toFixed(1) + "px");
          el.style.setProperty("--ly", y.toFixed(1) + "px");
          el.style.setProperty("--warm", warmth.toFixed(3));
        }}
      />
      <div className="gate-lamp" aria-hidden="true">
        <span className="gate-cord" />
        <Filament />
      </div>

      <div className="gate-card" ref={card}>
        <p className="eyebrow">
          <span className="seal">{site.monogram}</span>
          Private reading room
        </p>
        <h1 className="gate-title">
          The study is <em>dark.</em>
          <br />
          Bring the light.
        </h1>

        {locked ? (
          <div className="gate-form">
            <p className="gate-issue" role="alert">
              {owner.issue}
            </p>
            <button
              type="button"
              className="btn btn-brass btn-wide"
              onClick={() => void owner.signOut()}
            >
              Switch account
            </button>
          </div>
        ) : (
          <form className="gate-form" onSubmit={submit} noValidate>
            {owner.issue && (
              <p className="gate-issue" role="alert">
                {owner.issue}
              </p>
            )}
            <label className="paper-field">
              <span>Username</span>
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="paper-field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </label>
            {error && (
              <p className="gate-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-brass btn-wide"
              disabled={
                busy || !owner.canSignIn || !username.trim() || !password
              }
              aria-busy={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              ) : (
                <KeyRound size={17} aria-hidden="true" />
              )}
              {busy
                ? "Opening the room"
                : owner.canSignIn
                  ? "Enter the reading room"
                  : "Connecting"}
            </button>
          </form>
        )}

        <Link to="/shelf" className="gate-back">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to the shelf
        </Link>
      </div>

      <p className="gate-foot" aria-hidden="true">
        <span>{site.name}</span>
        <span>one lamp · {new Date().getFullYear()}</span>
      </p>
      <div className="gate-dark" aria-hidden="true" />
    </div>
  );
}

// The designed wait while the session and the library arrive.
export function Loading({ label }: { label: string }) {
  return (
    <div className="waiting" role="status" aria-live="polite">
      <div className="waiting-lamp" aria-hidden="true">
        <span className="gate-cord" />
        <Filament />
      </div>
      <p>{label}</p>
      <span className="waiting-rule" aria-hidden="true" />
    </div>
  );
}
