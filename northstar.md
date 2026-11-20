# Yuvraj’s Bookshelf

Yuvraj’s Bookshelf is Yuvraj Kashyap’s public bookshelf and private reading room at books.yuvrajkashyap.com. Opening it should make it easy to return to a book, rediscover something on the shelf, or choose the next read. The covers, typography, spacing, and transitions deserve as much attention as the database.

## Outcomes

- See one collection through a cover shelf, a spine shelf, a configurable table, and a chronological reading history. A book and its notes stay consistent across every view.
- Maintain exactly four categories: Wealth + Execution, Behavior + Mental Models, Identity + Discipline, and Misc.
- Keep three independently ordered queues and rotate Identity → Wealth → Behavior. Misc. stays outside the rotation. Queue position expresses preference. Exploring an alternative leaves the queues intact.
- Track To Read, Reading, and Completed, alongside optional progress, format, finish date, rating, and notes. Unknown dates stay unknown.
- Let authorized agents read and curate through the same operations as the interface. Suggestions can use notes, history, and the rotation. The product has no priority field, topic taxonomy, or payoff score.
- Own the library. Preserve the original Notion source, make exports portable, and keep private data inside Books’ access boundary.

The room should feel like a personal library shaped by curiosity. Let light, materials and fine instrument markings suggest a place of study. Keep those details secondary to the books and forgo named tributes or rotating displays.

Choose the smallest interaction that delivers a real benefit. Put visual and engineering effort into browsing, returning to context, and editing with confidence.

Visitors can browse titles, authors, covers and the four categories through GET /api/shelf. This read-only catalogue uses separate public book identifiers. Reading activity, notes, queue order, backups and mutations require authorized private access. The owner signs in at /admin.
