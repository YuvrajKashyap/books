import assert from "node:assert/strict";
import test from "node:test";
import { movedPositions } from "../backend/reorder.ts";

test("a queue move survives tied ranks in a restored backup", () => {
  const books = [
    { id: "a", queue_position: 0 }, { id: "b", queue_position: 0 },
    { id: "c", queue_position: 8 },
  ];
  const changes = movedPositions(books.slice(), 1, 0, "queue_position");
  const ranks = new Map(changes.map(b => [b.id, b.pos]));
  const rank = (b: typeof books[number]) => ranks.get(b.id) ?? b.queue_position;
  assert.deepEqual(books.sort((a, b) => rank(a) - rank(b)).map(b => b.id), ["b", "a", "c"]);
});
