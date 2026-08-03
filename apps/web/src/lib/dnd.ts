/**
 * Given a list already reordered client-side (positions changed, `sortOrder`
 * fields still hold their pre-drag values), reassigns the same pool of
 * `sortOrder` values to the new positions - mirrors the old two-item swap
 * approach, generalized to an arbitrary reorder, so it never introduces a
 * gap or duplicate into a shared/global sortOrder column.
 */
export function reorderedSortOrders<T extends { id: number; sortOrder: number }>(
  items: T[]
): { id: number; sortOrder: number }[] {
  const pool = items.map((item) => item.sortOrder).sort((a, b) => a - b)
  return items
    .map((item, index) => ({ id: item.id, sortOrder: pool[index]! }))
    .filter((update, index) => update.sortOrder !== items[index]!.sortOrder)
}
