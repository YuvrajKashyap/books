import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "vite";
import { bookNotes } from "../build/book-notes.ts";
import notes from "../frontend/src/shelf/synopses.json" with { type: "json" };
import { readNote, readOwnerNote } from "../frontend/src/shelf/bookNote.ts";
import { createHash } from "node:crypto";

test("each manuscript entry builds into a separate public note at its stable ID", async () => {
  const result = await build({
    configFile: false, logLevel: "silent", plugins: [bookNotes()],
    build: { write: false, lib: { entry: "shared/categories.ts", formats: ["es"] } },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
  const assets = new Map(outputs.flatMap(asset => asset.type === "asset" ? [[asset.fileName, asset.source] as const] : []));
  assert.equal(assets.size, Object.keys(notes).length);
  const base = [...assets.keys()][0].split("/").slice(0, -1).join("/");
  assert.match(base, /^assets\/book-notes\/[0-9a-f]{16}$/);
  for (const { id, ...note } of Object.values(notes)) {
    const source = assets.get(base + "/" + id + ".json");
    assert.equal(typeof source, "string");
    assert.deepEqual(JSON.parse(String(source)), note);
    assert.ok(note.brief.trim() && note.synopsis.trim() && note.author.trim());
  }
});

test("browsing and opening share one request, and a failed note can be retried", async t => {
  Object.assign(globalThis, { __BOOK_NOTES_PATH__: "/assets/book-notes/test/" });
  t.after(() => { Reflect.deleteProperty(globalThis, "__BOOK_NOTES_PATH__"); });
  const article = { brief: "A brief.", synopsis: "A longer note.", author: "Author context." };
  const fetchNote = t.mock.method(globalThis, "fetch", async () => Response.json(article));
  const preview = readNote("first", "low");
  assert.equal(readNote("first"), preview);
  assert.deepEqual(await preview, article);
  assert.deepEqual(await readNote("first"), article);
  assert.equal(fetchNote.mock.callCount(), 1);
  fetchNote.mock.mockImplementationOnce(async () => new Response(null, { status: 503 }));
  await assert.rejects(readNote("second"));
  assert.deepEqual(await readNote("second"), article);
  fetchNote.mock.mockImplementationOnce(async () => new Response(null, { status: 404 }));
  assert.equal(await readNote("uncatalogued"), null);
  assert.equal(await readNote("uncatalogued"), null);
  assert.equal(fetchNote.mock.callCount(), 4);
});

test("the owner editor reads the same public note as the shelf", async t => {
  Object.assign(globalThis, { __BOOK_NOTES_PATH__: "/assets/book-notes/test/" });
  t.after(() => { Reflect.deleteProperty(globalThis, "__BOOK_NOTES_PATH__"); });
  const ownerId = "example-owner-record";
  const publicId = createHash("sha256").update("books-public:" + ownerId).digest("hex").slice(0, 32);
  const fetchNote = t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
    assert.equal(url, "/assets/book-notes/test/" + publicId + ".json");
    return Response.json({ brief: "A shared synopsis.", synopsis: "More.", author: "An author." });
  });
  assert.equal(await readOwnerNote(ownerId), await readNote(publicId));
  assert.equal(fetchNote.mock.callCount(), 1);
});
