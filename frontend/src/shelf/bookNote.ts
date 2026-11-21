declare const __BOOK_NOTES_PATH__: string;
type Note = { brief: string; synopsis: string; author: string; source?: string };
const notes = new Map<string, Note | null>();
const requests = new Map<string, Promise<Note | null>>();

export const cachedNote = (id: string) => notes.get(id);

export function readNote(id: string) {
  const cached = notes.get(id);
  if (cached !== undefined) return Promise.resolve(cached);
  const pending = requests.get(id);
  if (pending) return pending;
  const request = fetch(__BOOK_NOTES_PATH__ + encodeURIComponent(id) + ".json")
    .then(async response => {
      if (!response.ok && response.status !== 404) throw new Error("Synopsis unavailable");
      const note: Note | null = response.ok ? await response.json() : null;
      notes.set(id, note);
      return note;
    })
    .finally(() => requests.delete(id));
  requests.set(id, request);
  return request;
}
