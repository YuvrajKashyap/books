import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalShelfParams,
  readView,
} from "../frontend/src/frontends/library/views.ts";

test("a shelf history entry keeps its view when the remembered preference changes", (t) => {
  let remembered = "rotunda";
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => remembered },
  });
  t.after(() => {
    if (originalStorage)
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  });
  const original = canonicalShelfParams(new URLSearchParams("q=habit"));
  remembered = "gravity";
  assert.equal(readView(original), "rotunda");
  assert.equal(original.get("q"), "habit");
  assert.equal(readView(new URLSearchParams("view=lamp")), "lamp");
});

test("old shared book and category links open the current reader and filter", () => {
  const old = new URLSearchParams(
    "view=lamp&pick=volume&category=Misc.&sort=title",
  );
  const current = canonicalShelfParams(old);
  assert.equal(current.get("book"), "volume");
  assert.equal(current.get("focus"), "Misc.");
  assert.equal(current.get("sort"), "title");
  assert.equal(current.has("pick") || current.has("category"), false);
  assert.equal(canonicalShelfParams(current).toString(), current.toString());
  old.set("book", "newer");
  assert.equal(canonicalShelfParams(old).get("book"), "newer");
});
