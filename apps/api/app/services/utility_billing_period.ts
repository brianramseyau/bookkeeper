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
 * The typical day-of-month a utility's bills actually arrive on, from
 * whichever recorded bills up to 12 *cycles* before `referenceYear`/
 * `referenceMonth` have a received date - the best estimate available for
 * projecting a due date into a month that hasn't been billed yet. Windowed
 * in cycles rather than flat calendar months so a monthly utility looks back
 * at most 12 months, but an annual or quarterly one still finds its last
 * handful of real bills instead of the window closing before a new one ever
 * arrives. Null if none of those bills has a received date recorded.
 */
export function typicalReceivedDayOfMonth(
  bills: UtilityBill[],
  referenceYear: number,
  referenceMonth: number,
  periodMonths = 1
): number | null {
  const referenceIndex = referenceYear * 12 + referenceMonth
  const windowMonths = 12 * periodMonths
  const days = bills.flatMap((bill) => {
    if (!bill.receivedOn) return []
    const monthsAgo = referenceIndex - (bill.year * 12 + bill.month)
    return monthsAgo >= 0 && monthsAgo < windowMonths ? [bill.receivedOn.day] : []
  })
  if (days.length === 0) return null
  return Math.round(days.reduce((sum, day) => sum + day, 0) / days.length)
}

/**
 * The due date for one specific (year, month), or null if either the
 * utility has no configured due-day offset, or that month isn't actually a
 * billing month for it (a non-monthly utility, e.g. a quarterly Water bill,
 * is only ever due in the months it's actually billed - see
 * `isUtilityBillingMonth`).
 *
 * `dueOffsetDays` is the number of days after the bill is actually received
 * that payment is due. For a month with a real bill on record, the due date
 * is exact only once that bill's received date has been entered - if it
 * hasn't, the due date is genuinely unknown rather than guessed, so this
 * returns null and leaves the gap visible. For a month with no bill on
 * record yet (forecasting ahead of the next bill actually arriving), it
 * falls back to `typicalReceivedDayOfMonth` to estimate when the bill will
 * likely turn up.
 */
export function utilityDueDateFor(
  utility: Utility,
  bills: UtilityBill[],
  year: number,
  month: number
): DateTime | null {
  if (utility.dueOffsetDays === null) return null
  if (!isUtilityBillingMonth(utility, bills, year, month)) return null

  const bill = bills.find((b) => b.year === year && b.month === month)
  if (bill) {
    if (!bill.receivedOn) return null
    // `.toUTC()` normalizes a DB-loaded date's zone (SQLite round-trips it
    // through a fixed-offset zone, not the literal UTC zone) so callers get
    // a consistent `Z`-suffixed ISO string either way.
    return bill.receivedOn.plus({ days: utility.dueOffsetDays }).toUTC()
  }

  const typicalDay = typicalReceivedDayOfMonth(
    bills,
    year,
    month,
    utilityPeriodMonths(utility.frequency)
  )
  if (typicalDay === null) return null

  // `daysInMonth` is only ever undefined for an invalid DateTime - (year,
  // month) here always comes from a real calendar month, so the `?? 31`
  // fallback can't actually fire. The lower bound doesn't need clamping -
  // `typicalReceivedDayOfMonth` averages real `DateTime.day` values, which
  // are never less than 1.
  const daysInMonth = /* c8 ignore next */ DateTime.utc(year, month, 1).daysInMonth ?? 31
  const day = Math.min(typicalDay, daysInMonth)
  const estimatedReceivedOn = DateTime.utc(year, month, day)
  return estimatedReceivedOn.plus({ days: utility.dueOffsetDays })
}

/**
 * The next upcoming due date from `today` onward - scans at most one full
 * billing cycle ahead so a non-monthly utility only turns up the next month
 * it's actually predicted to be billed in, not every month. Genuinely
 * returns null (not just as unreachable TypeScript control-flow padding) if
 * no bill for this utility has ever had a received date recorded -
 * `utilityDueDateFor` then has nothing to anchor an estimate on for any
 * month in the scanned range.
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
  return null
}

/**
 * Like `nextUtilityDueDate`, but skips forward past any billing period whose
 * bill is already marked paid - the "do I still owe this" question the
 * notification scheduler needs, layered on the same due-date math the
 * dashboard/trend chart use so the two can never disagree about *when* a
 * bill is due, only about whether an already-paid one should still count.
 * Scans a bounded number of months ahead (independent of `periodMonths`,
 * since paid-ahead periods can push the answer past a single cycle) so a
 * utility paid indefinitely ahead can't spin forever.
 */
export function nextUnpaidUtilityDueDate(
  utility: Utility,
  bills: UtilityBill[],
  today: DateTime
): DateTime | null {
  if (utility.dueOffsetDays === null) return null

  const paidPeriods = new Set(
    bills.filter((bill) => bill.paid).map((bill) => `${bill.year}-${bill.month}`)
  )

  let year = today.year
  let month = today.month

  for (let i = 0; i < 36; i++) {
    const due = utilityDueDateFor(utility, bills, year, month)
    if (due && due >= today && !paidPeriods.has(`${year}-${month}`)) return due

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return null
}
