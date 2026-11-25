import type { Library, View } from "../../../../shared/model";
import { Collection } from "./Collection";
import { Feature, Queues, Timeline, type Mutate } from "./Reading";

type Props = {
  page: "room" | "collection" | "queue" | "history";
  library: Library;
  view: View;
  setView: (view: View) => void;
  open: (id: string) => void;
  mutate: Mutate;
};

export default function OwnerPages({
  page,
  library,
  view,
  setView,
  open,
  mutate,
}: Props) {
  if (page === "queue")
    return <Queues library={library} mutate={mutate} open={open} />;
  if (page === "history") return <Timeline books={library.books} open={open} />;
  return (
    <>
      {page === "room" && <Feature library={library} open={open} />}
      <Collection
        books={library.books}
        views={library.views}
        view={view}
        setView={setView}
        open={open}
        mutate={mutate}
      />
    </>
  );
}
