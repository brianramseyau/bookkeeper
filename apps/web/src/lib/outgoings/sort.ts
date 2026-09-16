/**
 * Shared comparators for the list pages' sort controls (see `types.ts`'s
 * `OutgoingSortOption`). Adapters compose these into their `sorts` array so
 * the "Name (A-Z)" and "<metric> (high to low)" choices mean the same thing
 * on every page rather than each re-deriving a comparator.
 */

/** Case-insensitive, locale-aware name comparison. */
export function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

/**
 * Descending by a possibly-missing numeric value (e.g. a trend metric that
 * hasn't been computed yet). Missing values sort last regardless of direction.
 */
export function byValueDesc<T>(select: (item: T) => number | null | undefined) {
  return (a: T, b: T): number => {
    const av = select(a)
    const bv = select(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return bv - av
  }
}

/**
 * Ascending by a possibly-missing number or ISO date string (e.g. days until
 * due, day of month, next due date). Missing values sort last.
 */
export function byValueAsc<T>(select: (item: T) => number | string | null | undefined) {
  return (a: T, b: T): number => {
    const av = select(a)
    const bv = select(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv)
    return Number(av) - Number(bv)
  }
}
