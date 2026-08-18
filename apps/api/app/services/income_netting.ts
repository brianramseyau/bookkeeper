import IncomeTaxSetting from '#models/income_tax_setting'

export type MarginalRateMap = Map<string, number | null>

/** Every household marginal rate keyed by `${userId}:${financialYear}`. */
export async function loadMarginalRates(): Promise<MarginalRateMap> {
  const settings = await IncomeTaxSetting.query()
  return new Map(settings.map((t) => [`${t.userId}:${t.financialYear}`, t.marginalRate]))
}

/**
 * Net (usable) income for a set of entries: salary entries (source-tied)
 * are already net take-home (PAYG withheld at the source), while
 * unattributed "other" income nets through its owner's marginal rate for
 * the entry's financial year, falling back to the gross sale when tax was
 * withheld at source or no rate is set. Mirrors the Income page's chart
 * netting so the dashboard and the income charts never disagree.
 */
export function netIncomeForEntries(
  entries: {
    incomeSourceId: number | null
    userId: number | null
    year: number
    month: number
    amount: number
    taxWithheld: boolean | null
  }[],
  rates: MarginalRateMap
): number {
  let total = 0
  for (const entry of entries) {
    if (entry.incomeSourceId || entry.taxWithheld || entry.userId === null) {
      total += entry.amount
    } else {
      const financialYear = entry.month >= 7 ? entry.year + 1 : entry.year
      const rate = rates.get(`${entry.userId}:${financialYear}`) ?? null
      total += rate === null ? entry.amount : entry.amount - entry.amount * rate
    }
  }
  return Math.round(total * 100) / 100
}
