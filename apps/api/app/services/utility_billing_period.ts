import { DateTime } from 'luxon'
import type Utility from '#models/utility'
import type UtilityBill from '#models/utility_bill'
import type { MonthlyAmount } from '#services/rolling_average_service'

export const UTILITY_PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
}

export function utilityPeriodMonths(frequency: string): number {
  return UTILITY_PERIOD_MONTHS[frequency] ?? 1
}

/** The bill covering the most recently billed period - anchors billing cadence. */
export function mostRecentUtilityBill(bills: UtilityBill[]): UtilityBill | null {
  return bills.reduce<UtilityBill | null>((latest, bill) => {
    const billIndex = bill.year * 12 + bill.month
    const latestIndex = latest ? latest.year * 12 + latest.month : Number.NEGATIVE_INFINITY
    return billIndex > latestIndex ? bill : latest
  }, null)
}

/**
 * Whether (year, month) is a legitimate month to record a bill in for this
 * utility - always true for monthly utilities, and for non-monthly ones
 * true only in an actual billing month: one that already has a bill, or the
 * next one predicted by cadence from the most recently billed period.
 */
export function isUtilityBillingMonth(
  utility: Utility,
  bills: UtilityBill[],
  year: number,
  month: number
): boolean {
  const periodMonths = utilityPeriodMonths(utility.frequency)
  if (periodMonths <= 1) return true
  if (bills.some((bill) => bill.year === year && bill.month === month)) return true

  const anchor = mostRecentUtilityBill(bills)
  if (!anchor) return true

  const anchorIndex = anchor.year * 12 + anchor.month
  const viewedIndex = year * 12 + month
  const diff = (((viewedIndex - anchorIndex) % periodMonths) + periodMonths) % periodMonths
  return diff === 0
}

export interface UtilityMonthlyShare extends MonthlyAmount {
  billId: number
  /** The (year, month) of the real bill this share was split from. */
  billYear: number
  billMonth: number
  isBillingMonth: boolean
}

/**
 * A non-monthly bill (e.g. a quarterly Water bill) is entered once, dated
 * at the month it's actually billed, but covers several calendar months.
 * Expands each bill into one equal share per covered month so trends,
 * dashboards and the standard-month view can treat utilities as a plain
 * monthly series, the same way they always could when every utility was
 * billed monthly.
 *
 * Most utilities are billed in arrears (e.g. quarterly Water) - the bill's
 * (year, month) is the *last* month of the period it covers. A few are paid
 * in advance (e.g. annual Phones) - the bill's (year, month) is instead the
 * *first* month of the period. `paidInAdvance` picks which direction the
 * period runs from the bill's own month.
 */
export function expandUtilityBillsToMonthlyShares(
  bills: UtilityBill[],
  frequency: string,
  paidInAdvance = false
): UtilityMonthlyShare[] {
  const periodMonths = utilityPeriodMonths(frequency)
  const shares: UtilityMonthlyShare[] = []

  for (const bill of bills) {
    const share = bill.amount / periodMonths
    const billIndex = bill.year * 12 + (bill.month - 1)
    for (let step = 0; step < periodMonths; step++) {
      const index = paidInAdvance ? billIndex + step : billIndex - (periodMonths - 1 - step)
      const year = Math.floor(index / 12)
      const month = (((index % 12) + 12) % 12) + 1
      shares.push({
        year,
        month,
        amount: share,
        billId: bill.id,
        billYear: bill.year,
        billMonth: bill.month,
        isBillingMonth: paidInAdvance ? step === 0 : step === periodMonths - 1,
      })
    }
  }

  return shares
}

/**
 * The due date for one specific (year, month), or null if either the
 * utility has no configured due-day offset, or that month isn't actually a
 * billing month for it (a non-monthly utility, e.g. a quarterly Water bill,
 * is only ever due in the months it's actually billed - see
 * `isUtilityBillingMonth`). `dueOffsetDays` doubles as a plain day-of-month,
 * clamped to however many days that month actually has.
 */
export function utilityDueDateFor(
  utility: Utility,
  bills: UtilityBill[],
  year: number,
  month: number
): DateTime | null {
  if (utility.dueOffsetDays === null) return null
  if (!isUtilityBillingMonth(utility, bills, year, month)) return null

  // `daysInMonth` is only ever undefined for an invalid DateTime - (year,
  // month) here always comes from a real calendar month, so the `?? 31`
  // fallback can't actually fire.
  const daysInMonth = /* c8 ignore next */ DateTime.utc(year, month, 1).daysInMonth ?? 31
  const day = Math.min(Math.max(utility.dueOffsetDays, 1), daysInMonth)
  return DateTime.utc(year, month, day)
}

/**
 * The next upcoming due date from `today` onward - scans at most one full
 * billing cycle ahead so a non-monthly utility only turns up the next month
 * it's actually predicted to be billed in, not every month. The trailing
 * `return null` can't actually be reached: any `periodMonths`-long run of
 * consecutive months contains exactly one billing month (pigeonhole on the
 * cadence's fixed residue), and a billing month in a later calendar month
 * always has a due date >= today - it's kept only to satisfy TypeScript's
 * control-flow analysis, which can't know that.
 */
export function nextUtilityDueDate(
  utility: Utility,
  bills: UtilityBill[],
  today: DateTime
): DateTime | null {
  if (utility.dueOffsetDays === null) return null

  const periodMonths = utilityPeriodMonths(utility.frequency)
  let year = today.year
  let month = today.month

  for (let i = 0; i <= periodMonths; i++) {
    const due = utilityDueDateFor(utility, bills, year, month)
    if (due && due >= today) return due

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    /* c8 ignore next */
  }
  /* c8 ignore next 2 */
  return null
}
