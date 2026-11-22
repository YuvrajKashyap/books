// Carries a book between its place on the shelf and the reader as one object.
// The browser animates between the two elements that share the name below.
// The reader's jacket takes the name in CSS; the shelf copy takes it here.
const name = "open-book";

type FlightDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => {
    finished: Promise<void>;
  };
};

function settled(done: () => boolean) {
  return new Promise<void>((resolve) => {
    if (done()) return resolve();
    const finish = () => {
      observer.disconnect();
      clearTimeout(limit);
      resolve();
    };
    const observer = new MutationObserver(() => {
      if (done()) finish();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    const limit = setTimeout(finish, 900);
  });
}

const shelfCopy = (id: string) =>
  document.querySelector<HTMLElement>(
    `[data-book="${CSS.escape(id)}"] .volume-pick`,
  );
const readerOpen = () => Boolean(document.querySelector(".book-dialog[open]"));

function fly(update: () => Promise<void>, after: () => void) {
  const start = (document as FlightDocument).startViewTransition;
  if (!start || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    void update().finally(after);
    return;
  }
  start.call(document, update).finished.finally(after);
}

export function liftBook(id: string, open: () => void) {
  const book = shelfCopy(id);
  if (!book) return open();
  book.style.viewTransitionName = name;
  const release = () => {
    book.style.viewTransitionName = "";
  };
  fly(async () => {
    open();
    await settled(readerOpen);
    release();
  }, release);
}

export function reshelveBook(id: string, close: () => void) {
  let book: HTMLElement | null = null;
  fly(
    async () => {
      close();
      await settled(() => !readerOpen());
      book = shelfCopy(id);
      if (book) book.style.viewTransitionName = name;
    },
    () => {
      if (book) book.style.viewTransitionName = "";
    },
  );
}
