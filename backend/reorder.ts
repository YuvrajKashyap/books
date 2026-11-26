// The caller supplies one queue (or the whole shelf) in its displayed order.
export function movedPositions(
  lane: { id: string; [key: string]: unknown }[],
  from: number,
  to: number,
  column: "queue_position" | "position",
) {
  const [moving] = lane.splice(from, 1);
  lane.splice(to, 0, moving);
  // A portable backup can contain ties. Reusing the previous ranks would
  // silently undo a move between two books with the same rank.
  return lane.flatMap((book, pos) =>
    book[column] === pos ? [] : [{ id: book.id, pos }],
  );
}
