import { publicBookKey } from "../../../shared/public-book-key.ts";

declare const __BOOK_NOTES_PATH__: string;
type Note = {
  brief: string;
  synopsis: string;
  author: string;
  source?: string;
};
const notes = new Map<string, Note | null>();
const requests = new Map<string, Promise<Note | null>>();

export const cachedNote = (id: string) => notes.get(id);

export async function readOwnerNote(ownerId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(publicBookKey(ownerId)),
  );
  const publicId = Array.from(new Uint8Array(digest, 0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return readNote(publicId);
}

export function readNote(id: string, priority: RequestPriority = "auto") {
  const cached = notes.get(id);
  if (cached !== undefined) return Promise.resolve(cached);
  const pending = requests.get(id);
  if (pending) return pending;
  const request = fetch(
    __BOOK_NOTES_PATH__ + encodeURIComponent(id) + ".json",
    { priority },
  )
    .then(async (response) => {
      if (!response.ok && response.status !== 404)
        throw new Error("Synopsis unavailable");
      const note: Note | null = response.ok ? await response.json() : null;
      notes.set(id, note);
      return note;
    })
    .finally(() => requests.delete(id));
  requests.set(id, request);
  return request;
}

export function canWarmReader() {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return (
    !document.hidden &&
    !connection?.saveData &&
    !connection?.effectiveType?.includes("2g")
  );
}

export function warmNote(id: string) {
  if (!canWarmReader()) return;
  void readNote(id, "low").catch(() => {});
}
