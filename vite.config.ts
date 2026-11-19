import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { getRequestListener } from "@hono/node-server";
import { existsSync } from "node:fs";
import api from "./backend/app.js";
export default defineConfig({
  root: "frontend",
  build: {outDir:"../dist",emptyOutDir:true},
  plugins: [
    react(),
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
