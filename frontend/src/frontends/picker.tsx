// The review page: every frontend, one click away. Plain anchors on purpose,
// because each preview mounts its own router.
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import { ACTIVE, frontends } from "./registry";
import "./picker.css";

export default function Picker() {
  document.title = "Directions · Yuvraj’s Bookshelf";
  return (
    <main className="fx-picker">
      <header>
        <p className="pk-mark">Yuvraj’s Bookshelf</p>
        <h1>
          Frontends, <em>one shelf.</em>
        </h1>
        <p className="pk-lede">
          Every frontend this site can wear. They share the same books and the
          same sign-in. The live site wears <b>{ACTIVE}</b>; change one line in{" "}
          <code>frontends/registry.ts</code> to switch.
        </p>
      </header>
      <ol>
        {frontends.map((f, i) => (
          <li key={f.slug}>
            <a href={"/d/" + f.slug + "/"}>
              <span className="pk-n">{String(i).padStart(2, "0")}</span>
              <span className="pk-name">{f.name}</span>
              <span className="pk-idea">{f.idea}</span>
              <span className="pk-go" aria-hidden="true">
                →
              </span>
            </a>
            {f.rooms && (
              <a className="pk-rooms" href={"/d/" + f.slug + "/room"}>
                owner rooms
              </a>
            )}
            {f.slug === ACTIVE && <span className="pk-live">live</span>}
          </li>
        ))}
      </ol>
    </main>
  );
}
