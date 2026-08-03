import { api } from '$lib/api'

export interface StandardMonthLine {
  key: string
  label: string
  /** null when this line isn't projected forward at all (a non-recurring expense only ever shows its actual). */
  projected: number | null
  actual: number | null
  dueDay: number | null
  dueDate: string | null
  /**
   * Whether `dueDate` is a guess rather than a confirmed date - true when a
   * utility has no bill on record yet for this month, so `dueDate` was
   * projected from the average received-day of past bills instead of a
   * real received date.
   */
  dueDateEstimated: boolean
  /** Whether the money has actually left the account, independent of whether the amount is known. */
  paid: boolean
  /**
   * True when this is a recurring bill, subscription, or expense in a past
   * month with no payment record at all - `paid` and (for bills/
   * subscriptions) `actual` are placeholders standing in for missing
   * history rather than confirmed facts. Same concept as
   * `StandardMonthIncomeLine.estimated`.
   */
  estimated: boolean
  /**
   * False for a non-monthly utility line viewed in a month that isn't its
   * actual billing month - that figure is a computed share of a bill
   * entered elsewhere, not something to edit directly.
   */
  editable: boolean
  /** Date the bill was actually received (utilities only) - the anchor dueDate is derived from. */
  receivedOn: string | null
}

export interface StandardMonthIncomeLine {
  key: string
  label: string
  sourceId: number | null
  userId: number | null
  projected: number
  actual: number
  /**
   * True when this month is in the past and nothing was logged for this
   * source, so `actual` is a backfilled placeholder equal to `projected`.
   */
  estimated: boolean
  payDates: string[]
}

export interface StandardMonthResult {
  year: number
  month: number
  carryover: number
  income: {
    lines: StandardMonthIncomeLine[]
    projectedTotal: number
    actualTotal: number
  }
  expenses: {
    lines: StandardMonthLine[]
    projectedTotal: number
    actualTotal: number
  }
  projectedNet: number
  actualNet: number
}

export function getStandardMonth(year: number, month: number) {
  return api.get<StandardMonthResult>(`/standard-month?year=${year}&month=${month}`)
}
