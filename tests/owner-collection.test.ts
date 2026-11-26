import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { freshBook } from "../shared/model.ts";

test("owner history and grouped tables show dated completions first, oldest to newest", async (t) => {
  const vite = await createServer({
    configFile: false,
    root: "frontend",
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  t.after(() => vite.close());
  Object.assign(globalThis, {
    window: { matchMedia: () => ({ matches: false }) },
  });
  t.after(() => {
    Reflect.deleteProperty(globalThis, "window");
  });
  const load = (file: string) =>
    vite.ssrLoadModule("/src/frontends/rooms/" + file + ".tsx");
  const { RoomsContext } = await load("util");
  const { Collection } = await load("Collection");
  const { History } = await load("History");
  const books = [
    ["Undated fixture", null],
    ["Recent fixture", "2026-09-01"],
    ["Early fixture", "2024-02-01"],
    ["Middle fixture", "2026-02-01"],
  ].map(([title, finished], i) => ({
    ...freshBook(),
    id: "fixture-" + i,
    title,
    status: "Completed",
    finished,
    history: [],
  }));
  const library = {
    books: [
      ...books,
      {
        ...books[0],
        id: "reading",
        status: "Reading",
        title: "Current fixture",
      },
    ],
    views: [],
  };
  function render(room: typeof History, search: string) {
    return renderToStaticMarkup(
      h(
        MemoryRouter,
        { initialEntries: ["/" + search] },
        h(
          RoomsContext.Provider,
          { value: { owner: {}, library, open() {}, reduced: true } },
          h(room),
        ),
      ),
    );
  }
  for (const html of [
    render(History, ""),
    render(Collection, "?layout=table"),
  ]) {
    let previous = -1;
    for (const title of [
      "Early fixture",
      "Middle fixture",
      "Recent fixture",
      "Undated fixture",
    ]) {
      const index = html.indexOf(title);
      assert.ok(index > previous, title + " is out of order or missing");
      previous = index;
    }
  }
  assert.equal(
    render(Collection, "?layout=table").match(/<table>/g)?.length,
    2,
  );
  assert.equal(
    render(Collection, "?layout=table&group=None").match(/<table>/g)?.length,
    1,
  );
});
