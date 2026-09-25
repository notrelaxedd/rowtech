// How the dashboard names things it counts, and a seat the node was never told.

/** "1 seat", "2 seats": a count and its noun, singular for one. */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A seat session's name when it has no title: "Seat 3", or "Seat not set". */
export function seatTitle(seat: number | null): string {
  return seat === null ? "Seat not set" : `Seat ${seat}`;
}

/**
 * A seat in the dashboard's small readout labels: "seat 3", or "no seat"
 * where a node's seat was never set (short, as some of them sit in narrow
 * columns).
 */
export function seatLabel(seat: number | null): string {
  return seat === null ? "no seat" : `seat ${seat}`;
}
