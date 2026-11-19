import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { BookOpen, X, Bookmark, Leaf, Layers, Compass } from "lucide-react";
import { focuses, type Book } from "./model";
export type ShelfBook=Pick<Book,"id"|"title"|"author"|"focus"|"cover">;
export function Brand() {
  return (
    <span className="brand">
      <BookOpen size={27} strokeWidth={1.35} />
      Yuvraj’s Bookshelf<span className="brand-dot">.</span>
    </span>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  drawer = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "drawer" : ""}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon" aria-label="Close" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
const cloth = [
  "#394c55",
  "#a04735",
  "#455739",
  "#886031",
  "#344561",
  "#724857",
  "#3a6463",
  "#66543a",
];
export function ink(b: ShelfBook) {
  return cloth[
    [...b.id].reduce((n, c) => n + c.charCodeAt(0), 0) % cloth.length
  ];
}
export function Cover({ book: b }: { book: ShelfBook }) {
  const [failed, setFailed] = useState(""),
    [remote, setRemote] = useState("");
  const has = /^\d{13}$/.test(b.cover) && failed !== b.cover;
  return (
    <span
      aria-hidden="true"
      className={"cover " + (has ? "printed" : "bound")}
      style={{ "--cloth": ink(b) } as CSSProperties}
    >
      {has ? (
        <img
          alt=""
          src={
            remote === b.cover
              ? "https://covers.openlibrary.org/b/isbn/" +
                b.cover +
                "-M.jpg?default=false"
              : "/covers/" + b.cover + ".jpg"
          }
          onError={() =>
            remote === b.cover ? setFailed(b.cover) : setRemote(b.cover)
          }
          loading="lazy"
        />
      ) : (
        <>
          <span className="cover-author">{b.author || "Yuvraj’s Bookshelf"}</span>
          <span className="cover-title">{b.title}</span>
          <span className="seal">✳</span>
        </>
      )}
    </span>
  );
}
export function FocusIcon({ focus }: { focus: string }) {
  const Icon = [Leaf, Layers, Compass, Bookmark][
    Math.max(0, focuses.indexOf(focus as (typeof focuses)[number]))
  ];
  return <Icon size={15} />;
}
export function BookCard({
  book: b,
  open,
}: {
  book: ShelfBook;
  open: (id: string) => void;
}) {
  return (
    <button className="bookcard" onClick={() => open(b.id)}>
      <span className="bookmat">
        <Cover book={b} />
      </span>
      <strong>{b.title}</strong>
      <small>{b.author || "Author unlisted"}</small>
    </button>
  );
}
