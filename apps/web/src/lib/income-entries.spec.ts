import { describe, expect, it } from 'vitest'
import type { IncomeEntry } from './api/income'
import { entryGain, entryTax, sumEntryTotals } from './income-entries'

function makeEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: 1,
    incomeSourceId: null,
    userId: 1,
    year: 2026,
    month: 8,
    receivedOn: '2025-08-13T00:00:00.000+00:00',
    amount: 1000,
    note: 'Share sale',
    taxWithheld: false,
    ...overrides,
  }
}

describe('entryTax', () => {
  it('nets an other-income entry through the marginal rate', () => {
    expect(entryTax(makeEntry(), 0.37)).toBe(370)
  })

  it('is null with no marginal rate set', () => {
    expect(entryTax(makeEntry(), null)).toBeNull()
  })

  it('is null for a salary entry', () => {
    expect(entryTax(makeEntry({ incomeSourceId: 1 }), 0.37)).toBeNull()
  })

  it('is null for an item taxed at source', () => {
    expect(entryTax(makeEntry({ taxWithheld: true }), 0.37)).toBeNull()
  })
})

describe('entryGain', () => {
  it('is the amount net of the marginal-rate tax', () => {
    expect(entryGain(makeEntry(), 0.37)).toBe(630)
  })

  it('is null when there is no tax to subtract', () => {
    expect(entryGain(makeEntry({ taxWithheld: true }), 0.37)).toBeNull()
  })
})

describe('sumEntryTotals', () => {
  it('sums amounts and only the other-income tax/gain', () => {
    const salary = makeEntry({ id: 1, incomeSourceId: 1, amount: 5000 })
    const other = makeEntry({ id: 2, amount: 1000 })

    expect(sumEntryTotals([salary, other], 0.37)).toEqual({
      amount: 6000,
      tax: 370,
      gain: 630,
    })
  })

  it('reports no tax or gain when no rate is set', () => {
    expect(sumEntryTotals([makeEntry()], null)).toEqual({ amount: 1000, tax: 0, gain: 0 })
  })
})
