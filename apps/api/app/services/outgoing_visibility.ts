/**
 * Whether an outgoing item (recurring bill, subscription or expense) belongs
 * in a given month's list. Active items always do; paused/archived/removed
 * ones don't, because they're no longer an ongoing obligation - unless the
 * month in question has a payment record showing money actually left the
 * account then. Pausing or archiving an item later must not erase spend that
 * already happened, so that month's history still counts it.
 */
export interface OutgoingLifecycleFlags {
  isActive: boolean
  isPaused: boolean
  isArchived: boolean
}

export function isOutgoingVisibleForMonth(
  item: OutgoingLifecycleFlags,
  paidForMonth: boolean
): boolean {
  if (!item.isActive) return false
  if (!item.isPaused && !item.isArchived) return true
  return paidForMonth
}
