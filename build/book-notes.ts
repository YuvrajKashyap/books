import { createHash } from "node:crypto";
import type { Plugin } from "vite";
import manuscript from "../frontend/src/shelf/synopses.json" with { type: "json" };

// Each book is an independently cacheable static file. Keep the editable
// manuscript together and keep its prose out of the landing-page bundle.
export function bookNotes(): Plugin {
  const revision = createHash("sha256").update(JSON.stringify(manuscript)).digest("hex").slice(0, 16);
  const base = `assets/book-notes/${revision}/`;
  const files = new Map<string, string>();
  for (const [title, { id, ...note }] of Object.entries(manuscript)) {
    const path = `${base}${id}.json`;
    if (!/^[0-9a-f]{32}$/.test(id) || files.has(path)) throw Error("Invalid public book ID for " + title);
    files.set(path, JSON.stringify(note));
  }
  return {
    name: "public-book-notes",
    config: () => ({ define: { __BOOK_NOTES_PATH__: JSON.stringify("/" + base) } }),
    generateBundle() {
      for (const [fileName, source] of files) this.emitFile({ type: "asset", fileName, source });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0].slice(1);
        if (!path?.startsWith(base)) return next();
        const content = files.get(path);
        res.setHeader("Content-Type", "application/json");
        res.statusCode = content ? 200 : 404;
        res.end(content);
      });
    },
  };
}
