import type { ShelfBook } from "../components";
import { jacketFor } from "./artwork";
import { ArrowUpRight } from "lucide-react";

export function PrintEdition({ book }: { book: ShelfBook }) {
  const jacket = jacketFor(book);
  if (!jacket?.edition || !jacket.pages) return null;
  return <a className="edition-link" href={jacket.edition} target="_blank" rel="noreferrer">
    {jacket.pages} pages · {jacket.editionLabel ?? "print edition"} <ArrowUpRight size={13} aria-hidden="true"/>
  </a>;
}
