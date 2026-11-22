// Carries a book between its place on the shelf and the reader as one object.
// The browser animates between the two elements that share the name below.
// The reader's jacket takes the name in CSS; the shelf copy takes it here.
const name = "open-book";

type FlightDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => {
    ready: Promise<void>;
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

// The phone shelf loops, so one title can be on the page more than once.
// Fly from the copy nearest the middle of the screen that is actually visible.
function shelfCopy(id: string) {
  const copies = document.querySelectorAll<HTMLElement>(
    `[data-book="${CSS.escape(id)}"] .volume-pick`,
  );
  const middle = innerWidth / 2;
  let best: HTMLElement | null = null;
  let bestDistance = Infinity;
  for (const copy of copies) {
    const box = copy.getBoundingClientRect();
    if (
      !box.width ||
      box.right < 0 ||
      box.left > innerWidth ||
      box.bottom < 0 ||
      box.top > innerHeight
    )
      continue;
    const distance = Math.abs(box.left + box.width / 2 - middle);
    if (distance < bestDistance) {
      best = copy;
      bestDistance = distance;
    }
  }
  return best;
}
const readerOpen = () => Boolean(document.querySelector(".book-dialog[open]"));

function fly(update: () => Promise<void>, after: () => void) {
  const start = (document as FlightDocument).startViewTransition;
  if (!start || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    void update().finally(after);
    return;
  }
  const flight = start.call(document, update);
  // The browser may skip the animation (layout changed mid-flight, tab hidden).
  // The update still runs, so the skip itself is not an error.
  flight.ready.catch(() => {});
  void flight.finished.catch(() => {}).finally(after);
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
