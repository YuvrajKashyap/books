import postgres from "postgres";
import fs from "node:fs";
import ca from "../backend/supabase-ca.json" with { type: "json" };
const owner = process.env.BOOKS_OWNER_ID,
  db = postgres(process.env.BOOKS_DATABASE_URL, {
    prepare: false,
    ssl: { ca, rejectUnauthorized: true },
  });
const lib = JSON.parse(fs.readFileSync("private/cutover-library.json", "utf8"));
const archive = JSON.parse(
  fs.readFileSync("private/cutover-notion-archive.json", "utf8"),
);
try {
  await db.begin(async (sql) => {
    await sql`select set_config('books.owner',${owner},true)`;
    if ((await sql`select id from books.titles limit 1`).length)
      throw Error("Already populated");
    const rows = lib.books.map((b, position) => ({
      owner_id: owner,
      id: b.id,
      title: b.title,
      author: b.author,
      status: b.status,
      focus: b.focus,
      format: b.format,
      notes: b.notes,
      progress: b.progress,
      rating: b.rating,
      finished: b.finished || null,
      cover: b.cover || "",
      source: b.source || "",
      position,
      queue_position: position,
      history: sql.json(b.history),
    }));
    await sql`insert into books.titles ${sql(rows)}`;
    await sql`insert into books.archive values(${owner},${sql.json(archive)})`;
    await sql`update books.library set rotation=${lib.rotation},views=${sql.json(lib.views)} where owner_id=${owner}`;
    const [count] =
      await sql`select count(*) titles,(select jsonb_array_length(original->'pages') from books.archive) pages from books.titles`;
    console.log(count);
  });
} finally {
  await db.end();
}
