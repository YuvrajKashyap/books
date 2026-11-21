import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { getRequestListener } from "@hono/node-server";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import api from "./backend/app.js";
import { bookNotes } from "./build/book-notes.ts";
export default defineConfig({
  root: "frontend",
  build: {outDir:"../dist",emptyOutDir:true},
  server: { fs: { allow: ["frontend", "shared", "node_modules"].map(dir =>
    fileURLToPath(new URL("./" + dir, import.meta.url))) } },
  plugins: [
    react(),
    bookNotes(),
    {
      name: "books-api",
      configureServer(server) {
        if (existsSync("private/books.env"))
          process.loadEnvFile("private/books.env");
        const handler = getRequestListener(api.fetch);
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/")) void handler(req, res);
          else next();
        });
      },
    },
  ],
});
