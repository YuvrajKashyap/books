# Yuvraj’s Bookshelf

Yuvraj’s Bookshelf is a public catalogue with a private reading room at [books.yuvrajkashyap.com](https://books.yuvrajkashyap.com). Read [northstar.md](northstar.md) for the product goals. These two Markdown files are the project’s agent reading list.

## Code and development

One repository and one Vercel deployment. Vite builds the React interface in `src/`. React Router preserves book links and view state. TanStack Table powers the database layout. The cover shelf, spine shelf and timeline have custom presentations. Hono serves the HTTP API in `backend/app.ts` through the Node function in `api/index.ts`. The Vite dev server mounts that same Hono app. Shared field definitions and rotation rules live in `shared/model.ts`.

Use Node 24, `npm ci`, then `npm run dev`. Run `npm test` and `npm run build` before release. Vite can load local server settings from `private/books.env`. Set BOOKS_DATABASE_URL, BOOKS_OWNER_ID, BOOKS_OWNER_EMAIL (server-only address for the `yuvraj` login), SUPABASE_URL and SUPABASE_KEY. SUPABASE_KEY is the publishable key. AGENT_READ and AGENT_WRITE are optional server-only bearer credentials. Private files and environment values stay outside Git, builds and browser bundles.

## Supabase and ownership

Books uses the books schema in the shared yk-platform project. Only the existing owner’s Supabase Auth UUID is accepted. The browser signs in using email and password. This flow needs no OAuth callback or change to the shared project’s redirect configuration. The backend validates the access token with Supabase. Its pooler connection uses the dedicated books_runtime login with TLS, row-level security and transaction-local owner scope. Tables are private and do not require Data API exposure. Credentials for other applications and the Supabase service role are unnecessary at runtime.

The Books migrations in `supabase/migrations/` own its schema and the dedicated database role. Supply the role password separately during provisioning. Initialize the single owner row using the correct auth UUID. The initial migration copied the live prototype’s editable library and the complete Notion export into Postgres. The one-time importer requires explicit temporary insert privileges and an insert policy on the archive, both removed after verification. Production reads and writes use Postgres. Private source snapshots remain available for recovery.

## Runtime contract for agents

Send an Authorization Bearer credential over HTTPS. Use the read key for research and the write key only for authorized changes. Local credentials are in `private/agent-read.key` and `private/agent-write.key`. To revoke one, rotate its Vercel value and redeploy. Do not include keys in prompts, URLs, Git, or exports.

- GET /api/library returns version, revision, books, saved views and the rotation cursor. Array order is manual shelf order. Within a category, sort To Read entries by queuePosition for the queue. Use the rotation cursor across Identity, Wealth and Behavior, skipping empty queues.
- GET /api/archive returns the original Notion database definition, source rows and individual page responses. Linked files or resources remain references.
- POST /api/command accepts JSON with revision (from the latest read) and action. The commands are save, remove, move, shelfMove, rotation, view, removeView and restore. Consult the command union in backend/app.ts and the schemas in shared/model.ts for exact fields.
- For save, pass a complete editable book record and its existing id when updating. Omit id when adding. The server records history. Moving a book into Completed sets a missing finish date and records 100% progress. Existing undated completions stay undated.
- For move or shelfMove, pass id and target. The book moves to the target’s previous position. move operates inside one unread queue. shelfMove updates the cover order independently.
- For example, after reading revision 17, send `{"revision":17,"action":{"op":"move","id":"BOOK_ID","target":"TARGET_ID"}}`. A 409 means a newer revision exists. Read again and reconsider the intended change before retrying.
- Each command runs under a database transaction and a library revision lock. Successful responses return the next revision. A read-only key receives 403 on writes.

## Portability and release

Library settings exports a portable versioned JSON backup with books, history, both orders, views and rotation. Restore validates the backup and replaces the editable library atomically. The original Notion archive is independently downloadable. The source database had no completion-date field. Known dates sort oldest first, with undated completions shown separately in the timeline.

Deploy to the existing yk-reading-room project. Test a staged production build before promotion. Verify the custom domain, anonymous rejection, authenticated reads, role separation, stale writes, data reconciliation, reversible edits and view rendering. Keep the original import archive when changing storage.

Visitors can browse titles, authors, covers and the four categories through GET /api/shelf. This read-only catalogue uses separate public book identifiers. Reading activity, notes, queue order, backups and mutations require authorized private access. The owner signs in at /admin.

The Vite client lives in frontend/, the Hono service in backend/, the deployment entry point in api/, and portable types and library rules in shared/. The public room loads more shelves as you scroll. Jacket source records live in frontend/src/shelf/jackets.json. Original library jackets are identified in the book inspector. The oak material comes from the three.js example texture collection.

An authorized command may request the updated library with the header `Prefer: return=representation`. The response includes the committed revision, optional book ID and library snapshot. Omitting the header returns the compact receipt.
