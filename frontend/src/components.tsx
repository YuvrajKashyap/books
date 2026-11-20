import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { X, Bookmark, Leaf, Layers, Compass } from "lucide-react";
import type { Book } from "../../shared/model";
import { focuses } from "../../shared/categories";
import {jacketFor,smallShelfCover} from "./shelf/artwork";
export type ShelfBook=Pick<Book,"id"|"title"|"author"|"focus"|"cover">;
export function Brand() {
  return (
    <span className="brand">
      <span className="bookplate-seal" aria-hidden="true">YK</span>
      Yuvraj’s Bookshelf
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
export function Cover({ book: b, shelf = false, priority = false }: { book: ShelfBook; shelf?: boolean; priority?: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const isbn = /^\d{13}$/.test(b.cover) ? b.cover : "";
  const jacket = jacketFor(b);
  const src = [jacket?.file, isbn && "/covers/" + isbn + ".jpg", isbn && "https://covers.openlibrary.org/b/isbn/" + isbn + "-M.jpg?default=false"].find(url => url && !failed.includes(url));
  return (
    <span
      aria-hidden="true"
      className={"cover " + (src ? "printed" : "bound")}
      style={{ "--cloth": ink(b) } as CSSProperties}
    >
      {src ? (
        <picture style={{ display: "contents" }}>
          {shelf && jacket?.small && src === jacket.file && !failed.includes(jacket.small) && <source media={smallShelfCover} srcSet={jacket.small} />}
        <img
          alt=""
          src={src}
          onError={event => { const path = new URL(event.currentTarget.currentSrc || src, location.href).pathname; setFailed(previous => [...previous, path === jacket?.small ? path : src]); }}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
        /></picture>
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
