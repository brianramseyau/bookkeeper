import type { IncomeEntry } from './api/income'
import { round2 } from './format'

// Pure derivations for the Income page's entries table (see AGENTS.md's
// "pure display/derivation logic belongs in a $lib module").

/**
 * The marginal-rate tax on an "other income" entry, or null when it doesn't
 * apply: salary entries are already net (PAYG withheld at source), an item
 * with tax withheld at source has nothing further to deduct, and with no
 * rate set for the financial year there's no number to derive.
 */
export function entryTax(entry: IncomeEntry, marginalRate: number | null): number | null {
  if (marginalRate === null || entry.incomeSourceId !== null || entry.taxWithheld) return null
  return round2(entry.amount * marginalRate)
}

/** An "other income" entry's amount net of its marginal-rate tax, or null. */
export function entryGain(entry: IncomeEntry, marginalRate: number | null): number | null {
  const tax = entryTax(entry, marginalRate)
  return tax === null ? null : round2(entry.amount - tax)
}

export interface IncomeEntryTotals {
  amount: number
  tax: number
  gain: number
}

/**
 * Amount/Tax/Gain totals for the rows currently shown. Only "other income"
 * entries without tax withheld at source contribute tax/gain (salary is
 * already net - see `entryTax`).
 */
export function sumEntryTotals(
  entries: IncomeEntry[],
  marginalRate: number | null
): IncomeEntryTotals {
  let amount = 0
  let tax = 0
  let gain = 0
  for (const entry of entries) {
    amount += entry.amount
    const itemTax = entryTax(entry, marginalRate)
    if (itemTax !== null) {
      tax += itemTax
      gain += round2(entry.amount - itemTax)
    }
  }
  return { amount: round2(amount), tax: round2(tax), gain: round2(gain) }
}
