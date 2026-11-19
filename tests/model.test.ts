import test from "node:test";
import assert from "node:assert/strict";
import {
  bookFields,
  backupSchema,
  focuses,
  freshBook,
  nextPick,
  completed,
  type Book,
} from "../shared/model.ts";
const make = (
  id: string,
  focus: Book["focus"],
  values: Partial<Book> = {},
): Book => ({ ...freshBook(), id, title: id, focus, history: [], ...values });
test("rotation skips empty queues and excludes miscellaneous titles", () => {
  const books = [
    make("misc", focuses[3]),
    make("wealth", focuses[1]),
    make("other", focuses[1]),
  ];
  assert.equal(nextPick(books, 0)?.id, "wealth");
  assert.equal(nextPick([books[0]], 2), undefined);
});
test("history sorts known dates oldest first and preserves undated source order", () => {
  const books = ["a", "b", "c", "d"].map((id, i) =>
    make(id, focuses[0], {
      status: "Completed",
      finished: [null, "2026-04-01", "2024-05-03", null][i],
    }),
  );
  assert.deepEqual(
    completed(books).map((b) => b.id),
    ["c", "b", "a", "d"],
  );
  assert.deepEqual(
    books.map((b) => b.id),
    ["a", "b", "c", "d"],
  );
});
test("portable schema accepts exactly the four categories and bounds progress", () => {
  const b = make("a", focuses[0]);
  assert.ok(
    backupSchema.safeParse({ version: 1, books: [b], views: [], rotation: 0 })
      .success,
  );
  for (const change of [
    { focus: "Other" },
    { progress: 101 },
    { rating: 6 },
    { finished: "2026-02-30" },
  ])
    assert.equal(bookFields.safeParse({ ...b, ...change }).success, false);
});

test("manual shelf moves preserve the next pick in each category", () => {
  const first = make("first", focuses[0], { queuePosition: 0 }),
    second = make("second", focuses[0], { queuePosition: 1 });
  assert.equal(nextPick([second, first], 0)?.id, "first");
});
