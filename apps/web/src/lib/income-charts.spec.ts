import { describe, expect, it } from 'vitest'
import type { IncomeEntry } from './api/income'
import { buildYearlySeries } from './income-charts'

function makeEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: 1,
    incomeSourceId: 1,
    userId: null,
    year: 2026,
    month: 9,
    receivedOn: '2026-09-14T00:00:00.000Z',
    amount: 100,
    note: null,
    taxWithheld: null,
    ...overrides,
  }
}

const netOf = (entry: IncomeEntry) => entry.amount

describe('buildYearlySeries', () => {
  it('includes the current month (1-based), matching the YTD chart', () => {
    // 15 Sep 2026 - the current financial year is FY 2026-27 (Jul 2026-Jun
    // 2027), so the cumulative line should run Jul, Aug, Sep.
    const series = buildYearlySeries(
      [makeEntry({ month: 9, amount: 100 })],
      netOf,
      new Date(2026, 8, 15)
    )

    expect(series).toHaveLength(1)
    expect(series[0]!.label).toBe('FY 2026-27')
    expect(series[0]!.points).toEqual([
      { month: 7, total: 0 },
      { month: 8, total: 0 },
      { month: 9, total: 100 },
    ])
  })

  it('does not draw months after the current one', () => {
    const series = buildYearlySeries([makeEntry({ month: 10 })], netOf, new Date(2026, 8, 15))

    expect(series[0]!.points.map((p) => p.month)).toEqual([7, 8, 9])
  })

  it('accumulates a running total per financial year', () => {
    const series = buildYearlySeries(
      [makeEntry({ id: 1, month: 7, amount: 100 }), makeEntry({ id: 2, month: 8, amount: 50 })],
      netOf,
      new Date(2026, 8, 15)
    )

    expect(series[0]!.points).toEqual([
      { month: 7, total: 100 },
      { month: 8, total: 150 },
      { month: 9, total: 150 },
    ])
  })
})
