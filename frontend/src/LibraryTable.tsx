import {
  getCoreRowModel,
  useReactTable,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { columns, bookFields, statuses, type Book, type View } from "../../shared/model";
import type { Mutate } from "./Reading";

type Props = {
  books: Book[];
  view: View;
  open: (id: string) => void;
  mutate: Mutate;
  labels: Record<(typeof columns)[number], string>;
};

export default function LibraryTable({
  books,
  view,
  open,
  mutate,
  labels,
}: Props) {
  const defs: ColumnDef<Book>[] = [
    {
      accessorKey: "title",
      header: "Book",
      cell: (c) => (
        <button className="tabletitle" onClick={() => open(c.row.original.id)}>
          {c.row.original.title}
        </button>
      ),
    },
    ...columns.map((k) => ({
      accessorKey: k,
      header: labels[k],
      cell: ({ row }: { row: { original: Book } }) => {
        const b = row.original,
          value = b[k];
        if (k === "status")
          return (
            <select
              aria-label={"Status for " + b.title}
              value={b.status}
              onChange={(e) =>
                mutate({
                  op: "save",
                  id: b.id,
                  book: { ...bookFields.parse(b), status: e.target.value },
                })
              }
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          );
        return value === null || value === ""
          ? "—"
          : k === "progress"
            ? value + "%"
            : String(value);
      },
    })),
  ];
  const table = useReactTable({
    data: books,
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility: Object.fromEntries(view.hidden.map((k) => [k, false])),
    },
  });
  return (
    <div className="table-wrap">
      <table>
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.original.id}>
              {row.getVisibleCells().map((c) => (
                <td key={c.id}>
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
