import { z } from "zod";
import { focuses } from "./categories.ts";
export { focuses };
export const statuses = ["Reading", "To Read", "Completed"] as const;
export const columns = [
  "author",
  "focus",
  "status",
  "format",
  "progress",
  "rating",
  "finished",
] as const;
export const bookFields = z.object({
  title: z.string().trim().min(1).max(1000),
  author: z.string().max(2000),
  focus: z.enum(focuses),
  status: z.enum(statuses),
  format: z.string().max(500),
  notes: z.string().max(200000),
  progress: z.number().int().min(0).max(100).nullable(),
  rating: z.number().min(1).max(5).nullable(),
  finished: z.iso.date().nullable(),
  cover: z.string().regex(/^(\d{13})?$/),
  source: z.union([z.literal(""), z.url({ protocol: /^https$/ })]),
});
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const bookSchema = bookFields.extend({
  id: idSchema,
  queuePosition: z.number().int().nonnegative().optional(),
  history: z.array(z.object({ at: z.string(), event: z.string() })),
});
export type Book = z.infer<typeof bookSchema>;
export const viewSchema = z.object({
  name: z.string().trim().min(1).max(80),
  layout: z.enum(["shelf", "spines", "table"]),
  focus: z.union([z.literal(""), z.enum(focuses)]),
  status: z.union([z.literal(""), z.enum(statuses)]),
  group: z.enum(["Status", "Focus", "None"]),
  sort: z.enum(["Shelf order", "Title", "Author", "Rating"]),
  hidden: z.array(z.enum(columns)),
  query: z.string().max(500),
});
export type View = z.infer<typeof viewSchema>;
export const initialView: View = {
  name: "My collection",
  layout: "spines",
  focus: "",
  status: "",
  group: "Status",
  sort: "Shelf order",
  hidden: ["progress", "rating", "finished"],
  query: "",
};
export const backupSchema = z.object({
  version: z.literal(1),
  books: z.array(bookSchema).max(10000),
  views: z.array(viewSchema).max(100),
  rotation: z.number().int().min(0).max(2),
});
export type Library = z.infer<typeof backupSchema> & { revision: number };
export const freshBook = (): z.infer<typeof bookFields> => ({
  title: "",
  author: "",
  focus: "Misc.",
  status: "To Read",
  format: "",
  notes: "",
  progress: null,
  rating: null,
  finished: null,
  cover: "",
  source: "",
});
export function queue(books: Book[], focus: string) {
  return books
    .filter((b) => b.status === "To Read" && b.focus === focus)
    .sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
}
export function nextPick(books: Book[], rotation: number) {
  for (let i = 0; i < 3; i++) {
    const b = queue(books, focuses[(rotation + i) % 3])[0];
    if (b) return b;
  }
}
export function completed(books: Book[]) {
  return books
    .filter((b) => b.status === "Completed")
    .sort((a, b) => {
      if (!a.finished || !b.finished)
        return Number(!a.finished) - Number(!b.finished);
      return a.finished.localeCompare(b.finished);
    });
}
