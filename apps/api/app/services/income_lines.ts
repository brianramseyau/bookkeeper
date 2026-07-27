import { DateTime } from 'luxon'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import { payDatesInMonth, payPeriodsInMonth } from '#services/income_cadence'

export interface IncomeLine {
  key: string
  label: string
  sourceId: number | null
  userId: number | null
  projected: number
  actual: number
  /**
   * True when this month is in the past and nothing was ever logged for
   * this source, so `actual` has been backfilled from `projected` rather
   * than reflecting a real recorded payment - a placeholder until a real
   * entry is logged (or confirmed) for the month.
   */
  estimated: boolean
  /**
   * ISO dates this source is expected to pay out in this month - usually
   * one (monthly) or two (fortnightly), but genuinely three for a
   * fortnightly source a couple of times a year. Surfaced so the "why is
   * this projection higher than usual" question has a visible answer.
   */
  payDates: string[]
}

export interface IncomeLinesResult {
  lines: IncomeLine[]
  projectedTotal: number
  actualTotal: number
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function isPastMonth(year: number, month: number): boolean {
  const now = DateTime.now()
  return year * 12 + month < now.year * 12 + now.month
}

/**
 * Aggregates projected vs. actual income for a given month, across every
 * active income source plus any unattributed entries. For a month that's
 * already elapsed with nothing logged against a source, `actual` falls
 * back to that source's projected figure (flagged via `estimated`) rather
 * than showing a misleading $0 - real historical income doesn't disappear
 * just because it predates per-pay-period entry logging.
 */
export async function computeIncomeLines(year: number, month: number): Promise<IncomeLinesResult> {
  const [sources, entries] = await Promise.all([
    IncomeSource.query().where('isActive', true).orderBy('name', 'asc'),
    IncomeEntry.query().where('year', year).where('month', month),
  ])

  const actualBySource = new Map<number, number>()
  const unattributedByUser = new Map<number | null, number>()
  for (const entry of entries) {
    if (entry.incomeSourceId) {
      actualBySource.set(
        entry.incomeSourceId,
        (actualBySource.get(entry.incomeSourceId) ?? 0) + entry.amount
      )
    } else {
      unattributedByUser.set(
        entry.userId,
        (unattributedByUser.get(entry.userId) ?? 0) + entry.amount
      )
    }
  }

  const past = isPastMonth(year, month)

  const lines: IncomeLine[] = sources.map((source) => {
    const projected = round(source.expectedAmount * payPeriodsInMonth(source, year, month))
    const estimated = past && !actualBySource.has(source.id)
    return {
      key: `income-source-${source.id}`,
      label: source.name,
      sourceId: source.id,
      userId: source.userId,
      projected,
      actual: estimated ? projected : round(actualBySource.get(source.id) ?? 0),
      estimated,
      payDates: payDatesInMonth(source, year, month).map((date) => date.toISO() as string),
    }
  })

  for (const [userId, total] of unattributedByUser) {
    if (total <= 0) continue
    lines.push({
      key: `income-unattributed-${userId ?? 'none'}`,
      label: 'Other income',
      sourceId: null,
      userId,
      projected: 0,
      actual: round(total),
      estimated: false,
      payDates: [],
    })
  }

  return {
    lines,
    projectedTotal: round(lines.reduce((sum, line) => sum + line.projected, 0)),
    actualTotal: round(lines.reduce((sum, line) => sum + line.actual, 0)),
  }
}
