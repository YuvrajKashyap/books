// A page left open across a deploy still asks for the old code chunks,
// which are gone, so a lazy import fails and the page would go blank. When
// that happens, reload once to pick up the new build. A second failure
// within a minute is real and is let through.
const key = "books-stale-reload";

export function reloadOnStale<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((error: unknown) => {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(key)) || 0;
      } catch {
        // No storage: reloading could loop, so let the error through.
        throw error;
      }
      if (Date.now() - last < 60_000) throw error;
      try {
        sessionStorage.setItem(key, String(Date.now()));
      } catch {
        throw error;
      }
      location.reload();
      // Keep the page as it is until the reload takes over.
      return new Promise<T>(() => {});
    });
}
