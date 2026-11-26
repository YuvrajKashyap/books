import { ownerLogin } from "./login.js";
import { movedPositions } from "./reorder.js";
import { publicBookKey } from "../shared/public-book-key.js";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { timingSafeEqual, createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import ca from "./supabase-ca.json" with { type: "json" };
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  bookFields,
  backupSchema,
  idSchema,
  viewSchema,
  focuses,
  type Book,
} from "../shared/model.js";
const app = new Hono<{ Variables: { write: boolean } }>();
const env = (name: string) => process.env[name]?.trim() || "";
let pool: ReturnType<typeof postgres>;
const db = () =>
  (pool ??= postgres(env("BOOKS_DATABASE_URL"), {
    ssl: { ca, rejectUnauthorized: true },
    max: 2,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  }));
const equal = (a: string, b: string) =>
  Boolean(a && b) &&
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
app.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});
app.get("/api/config", (c) => {
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");
  return c.json({ url: env("SUPABASE_URL"), key: env("SUPABASE_KEY") });
});
app.post("/api/login", bodyLimit({ maxSize: 4096 }), c => ownerLogin(c, {
  email: env("BOOKS_OWNER_EMAIL"), ownerId: env("BOOKS_OWNER_ID"),
  url: env("SUPABASE_URL"), key: env("SUPABASE_KEY"),
}));
app.get("/api/shelf", async (c) => {
  const started = performance.now();
  const books = await db().begin("read only", async (tx) => {
    await scope(tx);
    const rows =
      await tx`select id,title,author,focus,cover from books.titles order by lower(title),id`;
    return rows.map(({ id, title, author, focus, cover }) => ({
      id: createHash("sha256")
        .update(publicBookKey(id))
        .digest("hex")
        .slice(0, 32),
      title,
      author,
      focus,
      cover,
    }));
  });
  // On CDN hits this describes the cache fill, not the current request.
  c.header("Server-Timing", `catalogue;dur=${(performance.now() - started).toFixed(1)};desc="Origin catalogue transaction and mapping"`);
  c.header("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=30");
  return c.json({ books });
});
app.use("/api/*", async (c, next) => {
  const token = /^Bearer ([^\s]+)$/i.exec(c.req.header("Authorization") || "")?.[1] || "";
  let write = equal(token, env("AGENT_WRITE")),
    read = write || equal(token, env("AGENT_READ"));
  if (!read && token) {
    const auth = createClient(env("SUPABASE_URL"), env("SUPABASE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await auth.auth.getUser(token);
    read = !error && data.user?.id === env("BOOKS_OWNER_ID");
    write = read;
  }
  if (!read)
    throw new HTTPException(401, {
      message: "Sign in with the library owner account.",
    });
  if (c.req.method !== "GET" && !write)
    throw new HTTPException(403, { message: "This key has read-only access." });
  c.set("write", write);
  await next();
});
app.use("/api/command", bodyLimit({ maxSize: 4_000_000 }));
type Tx = postgres.TransactionSql;
const scope = (tx: Tx) =>
  tx`select set_config('books.owner',${env("BOOKS_OWNER_ID")},true)`;
const fields = async (tx: Tx) =>
  (await tx`select id,title,author,status,focus,format,notes,progress,rating::float8,finished::text,cover,source,queue_position as "queuePosition",history from books.titles order by position,id`) as unknown as Book[];
const header = async (tx: Tx, lock = false) =>
  (
    await tx`select rotation,revision,views from books.library where owner_id=${env("BOOKS_OWNER_ID")} ${lock ? tx`for update` : tx``}`
  )[0];
app.get("/api/library", async (c) =>
  c.json(
    await db().begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await scope(tx);
        const [meta, books] = await Promise.all([header(tx), fields(tx)]);
        return { version: 1, ...meta, books };
      },
    ),
  ),
);
app.get("/api/archive", async (c) =>
  c.json(
    await db().begin(async (tx) => {
      await scope(tx);
      return (await tx`select original from books.archive`)[0].original;
    }),
  ),
);
const command = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("save"),
    id: idSchema.optional(),
    book: bookFields,
  }),
  z.object({ op: z.literal("remove"), id: idSchema }),
  z.object({ op: z.literal("move"), id: idSchema, target: idSchema }),
  z.object({ op: z.literal("shelfMove"), id: idSchema, target: idSchema }),
  z.object({
    op: z.literal("rotation"),
    rotation: z.number().int().min(0).max(2),
  }),
  z.object({ op: z.literal("view"), view: viewSchema }),
  z.object({ op: z.literal("removeView"), name: z.string() }),
  z.object({ op: z.literal("restore"), backup: backupSchema }),
]);
app.post("/api/command", async (c) => {
  const { revision, action } = z
    .object({ revision: z.number().int(), action: command })
    .parse(await c.req.json());
  const result = await db().begin(async (tx) => {
    await scope(tx);
    const meta = await header(tx, true);
    if (meta.revision !== revision)
      throw new HTTPException(409, {
        message:
          "Your library changed. Review the refreshed version and retry.",
      });
    const owner = env("BOOKS_OWNER_ID");
    let selectedId: string | undefined;
    if (action.op === "save") {
      const old = action.id
        ? (await tx`select * from books.titles where id=${action.id}`)[0]
        : undefined;
      if (action.id && !old) throw new HTTPException(404);
      const b = { ...action.book };
      const newlyCompleted =
        b.status === "Completed" && old?.status !== "Completed";
      if (newlyCompleted) {
        b.progress = 100;
        b.finished ??= new Date().toLocaleDateString("en-CA", {
          timeZone: "America/Chicago",
        });
      }
      const changes = old
        ? Object.keys(b).filter(
            (k) =>
              String(old[k] ?? "") !== String(b[k as keyof typeof b] ?? ""),
          )
        : [];
      const event = !old
        ? "Added to " + b.status
        : old.status !== b.status
          ? "Moved to " + b.status
          : changes.includes("progress")
            ? b.progress === null
              ? "Progress cleared"
              : "Progress updated to " + b.progress + "%"
            : "Edited " + (changes.join(", ") || "book");
      const history = [
        ...(old?.history || []),
        { at: new Date().toISOString(), event },
      ];
      const id = action.id || randomUUID();
      selectedId = id;
      if (
        b.status === "Reading" &&
        old?.status === "To Read" &&
        b.focus === old.focus
      ) {
        const available =
          await tx`select distinct focus from books.titles where status='To Read'`;
        const active = [0, 1, 2]
          .map((i) => (meta.rotation + i) % 3)
          .find((i) => available.some((r) => r.focus === focuses[i]));
        if (active !== undefined && b.focus === focuses[active])
          await tx`update books.library set rotation=${(active + 1) % 3}`;
      }
      const enteringQueue =
        b.status === "To Read" &&
        (!old || old.status !== "To Read" || old.focus !== b.focus);
      const queuePosition = enteringQueue
        ? (
            await tx`select coalesce(max(queue_position),-1)+1 n from books.titles where focus=${b.focus}`
          )[0].n
        : (old?.queue_position ?? 0);
      const record = {
        ...b,
        queue_position: queuePosition,
        history: tx.json(history),
      };
      if (old) await tx`update books.titles set ${tx(record)} where id=${id}`;
      else {
        const [last] =
          await tx`select coalesce(max(position),-1)+1 n from books.titles`;
        await tx`insert into books.titles ${tx({ ...record, id, owner_id: owner, position: last.n })}`;
      }
    } else if (action.op === "remove") {
      const rows =
        await tx`delete from books.titles where id=${action.id} returning id`;
      if (!rows.length) throw new HTTPException(404);
    } else if (action.op === "move" || action.op === "shelfMove") {
      const isQueue = action.op === "move";
      const books =
        await tx<{ id: string; position: number; queue_position: number; focus: string; status: string }[]>`select id,position,queue_position,focus,status from books.titles order by ${isQueue ? tx`queue_position,position` : tx`position`},id`;
      const moving = books.find((b) => b.id === action.id),
        target = books.find((b) => b.id === action.target);
      if (!moving || !target) throw new HTTPException(404);
      if (
        isQueue &&
        (moving.focus !== target.focus ||
          moving.status !== "To Read" ||
          target.status !== "To Read")
      )
        throw new HTTPException(400, {
          message: "Choose two unread books in the same queue.",
        });
      const lane = isQueue
        ? books.filter(
            (b) => b.focus === moving.focus && b.status === "To Read",
          )
        : Array.from(books);
      const col = isQueue ? "queue_position" : "position";
      const changes = movedPositions(lane, lane.indexOf(moving), lane.indexOf(target), col);
      if (changes.length)
        await tx`update books.titles t set ${tx(col)}=p.pos from jsonb_to_recordset(${tx.json(changes)}::jsonb) as p(id text,pos integer) where t.id=p.id`;
    } else if (action.op === "rotation")
      await tx`update books.library set rotation=${action.rotation}`;
    else if (action.op === "view" || action.op === "removeView") {
      const name = action.op === "view" ? action.view.name : action.name;
      const views = meta.views.filter((v: { name: string }) => v.name !== name);
      if (action.op === "view") views.push(action.view);
      if (views.length > 100) throw new HTTPException(400);
      await tx`update books.library set views=${tx.json(views)}`;
    } else {
      const { books, views, rotation } = action.backup;
      if (new Set(books.map((b) => b.id)).size !== books.length)
        throw new HTTPException(400, { message: "Duplicate book IDs." });
      await tx`delete from books.titles`;
      for (let i = 0; i < books.length; i += 100) {
        const batch = books.slice(i, i + 100).map((b, j) => ({
          ...bookFields.parse(b),
          id: b.id,
          queue_position: b.queuePosition ?? i + j,
          position: i + j,
          owner_id: owner,
          history: tx.json(b.history),
        }));
        await tx`insert into books.titles ${tx(batch)}`;
      }
      await tx`update books.library set rotation=${rotation},views=${tx.json(views)}`;
    }
    await tx`update books.library set revision=revision+1`;
    const receipt = { revision: revision + 1, id: selectedId };
    if (c.req.header("Prefer") === "return=representation") {
      return { ...receipt, library: { version: 1, ...(await header(tx)), books: await fields(tx) } };
    }
    return receipt;
  });
  return c.json(result);
});
app.onError((e, c) => {
  if (e instanceof HTTPException) return c.json({ error: e.message }, e.status);
  if (e instanceof z.ZodError || e instanceof SyntaxError)
    return c.json({ error: "Check the supplied fields and try again." }, 400);
  console.error("Books request failed", e.name, (e as { code?: string }).code);
  return c.json(
    { error: "Library storage is unavailable. Please retry." },
    503,
  );
});
export default app;
