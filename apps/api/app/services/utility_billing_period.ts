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
 */
export function expandUtilityBillsToMonthlyShares(
  bills: UtilityBill[],
  frequency: string
): UtilityMonthlyShare[] {
  const periodMonths = utilityPeriodMonths(frequency)
  const shares: UtilityMonthlyShare[] = []

  for (const bill of bills) {
    const share = bill.amount / periodMonths
    for (let offset = periodMonths - 1; offset >= 0; offset--) {
      const index = bill.year * 12 + (bill.month - 1) - offset
      const year = Math.floor(index / 12)
      const month = (((index % 12) + 12) % 12) + 1
      shares.push({
        year,
        month,
        amount: share,
        billId: bill.id,
        billYear: bill.year,
        billMonth: bill.month,
        isBillingMonth: offset === 0,
      })
    }
  }

  return shares
}
