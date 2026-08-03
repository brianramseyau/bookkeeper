import { describe, expect, it } from 'vitest'
import type { IncomeEntry } from './api/income'
import type { StandardMonthIncomeLine } from './api/standard-month'
import { entriesForLine, entryRowLabel, incomeRowsForLine } from './income-rows'

function makeEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: 1,
    incomeSourceId: 10,
    userId: null,
    year: 2026,
    month: 3,
    receivedOn: '2026-03-15',
    amount: 500,
    note: null,
    taxWithheld: null,
    ...overrides,
  }
}

function makeLine(overrides: Partial<StandardMonthIncomeLine> = {}): StandardMonthIncomeLine {
  return {
    key: 'source-10',
    label: 'Salary',
    sourceId: 10,
    userId: 1,
    projected: 1000,
    actual: 0,
    estimated: false,
    payDates: [],
    ...overrides,
  }
}

describe('entriesForLine', () => {
  it('matches entries by sourceId for a sourced line', () => {
    const entries = [
      makeEntry({ id: 1, incomeSourceId: 10 }),
      makeEntry({ id: 2, incomeSourceId: 20 }),
    ]
    expect(entriesForLine(entries, makeLine()).map((e) => e.id)).toEqual([1])
  })

  it('matches unattributed entries by userId for an unsourced line', () => {
    const entries = [
      makeEntry({ id: 1, incomeSourceId: null, userId: 1 }),
      makeEntry({ id: 2, incomeSourceId: null, userId: 2 }),
      makeEntry({ id: 3, incomeSourceId: 10, userId: 1 }),
    ]
    const line = makeLine({ sourceId: null, userId: 1 })
    expect(entriesForLine(entries, line).map((e) => e.id)).toEqual([1])
  })

  it('sorts matched entries by receivedOn', () => {
    const entries = [
      makeEntry({ id: 1, receivedOn: '2026-03-20' }),
      makeEntry({ id: 2, receivedOn: '2026-03-05' }),
    ]
    expect(entriesForLine(entries, makeLine()).map((e) => e.id)).toEqual([2, 1])
  })
})

describe('incomeRowsForLine', () => {
  it('pairs an entry with its pay date positionally', () => {
    const entries = [makeEntry({ id: 1, receivedOn: '2026-03-15', amount: 500 })]
    const line = makeLine({ payDates: ['2026-03-15'] })
    const rows = incomeRowsForLine(entries, line)
    expect(rows).toEqual([{ type: 'actual', key: 'entry-1', entry: entries[0], projected: 1000 }])
  })

  it('produces a placeholder row for a pay date with no logged entry', () => {
    const line = makeLine({ payDates: ['2026-03-15'] })
    const rows = incomeRowsForLine([], line)
    expect(rows).toEqual([
      {
        type: 'placeholder',
        key: 'placeholder-source-10-2026-03-15',
        date: '2026-03-15',
        projected: 1000,
      },
    ])
  })

  it('leaves projected null for an entry beyond the known pay dates', () => {
    const entries = [
      makeEntry({ id: 1, receivedOn: '2026-03-01' }),
      makeEntry({ id: 2, receivedOn: '2026-03-28' }),
    ]
    const line = makeLine({ payDates: ['2026-03-01'] })
    const rows = incomeRowsForLine(entries, line)
    expect(rows[1]).toMatchObject({ type: 'actual', projected: null })
  })

  it('has no pay dates for an unattributed line, so every entry is an actual row', () => {
    const entries = [makeEntry({ id: 1, incomeSourceId: null, userId: 1 })]
    const line = makeLine({ sourceId: null, userId: 1, payDates: [] })
    const rows = incomeRowsForLine(entries, line)
    expect(rows).toEqual([{ type: 'actual', key: 'entry-1', entry: entries[0], projected: null }])
  })
})

describe('entryRowLabel', () => {
  it('includes the received date when known', () => {
    expect(entryRowLabel(makeEntry({ receivedOn: '2026-03-15' }))).toBe('entry from 15 Mar 2026')
  })

  it('falls back to a bare label with no received date', () => {
    expect(entryRowLabel(makeEntry({ receivedOn: null }))).toBe('entry')
  })
})
