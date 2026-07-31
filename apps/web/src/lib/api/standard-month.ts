import { api } from '$lib/api'

export interface StandardMonthLine {
  key: string
  label: string
  /** null when this line isn't projected forward at all (a non-recurring expense only ever shows its actual). */
  projected: number | null
  actual: number | null
  dueDay: number | null
  dueDate: string | null
  /** Whether the money has actually left the account, independent of whether the amount is known. */
  paid: boolean
  /**
   * False for a non-monthly utility line viewed in a month that isn't its
   * actual billing month - that figure is a computed share of a bill
   * entered elsewhere, not something to edit directly.
   */
  editable: boolean
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
