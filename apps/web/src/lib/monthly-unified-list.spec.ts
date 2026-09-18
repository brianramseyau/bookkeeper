import { describe, expect, it } from 'vitest'
import type { IncomeEntry } from './api/income'
import type { StandardMonthIncomeLine, StandardMonthLine } from './api/standard-month'
import { buildUnifiedList } from './monthly-unified-list'

function makeExpenseLine(overrides: Partial<StandardMonthLine> = {}): StandardMonthLine {
  return {
    key: 'recurring-bill-1',
    label: 'Internet',
    projected: 80,
    actual: null,
    dueDay: null,
    dueDate: null,
    dueDateEstimated: false,
    paid: false,
    estimated: false,
    editable: true,
    receivedOn: null,
    ...overrides,
  }
}

function makeIncomeLine(overrides: Partial<StandardMonthIncomeLine> = {}): StandardMonthIncomeLine {
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

describe('buildUnifiedList', () => {
  it('interleaves outgoing lines and income rows by resolved date', () => {
    const expenseLines = [
      makeExpenseLine({ key: 'utility-1', label: 'Electricity', dueDate: '2026-03-20' }),
      makeExpenseLine({ key: 'recurring-bill-2', label: 'Kayo', dueDay: 5 }),
    ]
    const entries = [makeEntry({ id: 1, receivedOn: '2026-03-10' })]
    const incomeLines = [makeIncomeLine({ payDates: ['2026-03-10'] })]

    const items = buildUnifiedList(expenseLines, incomeLines, entries, 2026, 3)

    expect(items.map((i) => i.key)).toEqual(['recurring-bill-2', 'entry-1', 'utility-1'])
  })

  it('places placeholder income rows by their pay date', () => {
    const incomeLines = [makeIncomeLine({ payDates: ['2026-03-01', '2026-03-28'] })]
    const items = buildUnifiedList([], incomeLines, [], 2026, 3)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ type: 'income', date: '2026-03-01' })
    expect(items[1]).toMatchObject({ type: 'income', date: '2026-03-28' })
  })

  it('sorts undated items last, keeping their original relative order', () => {
    const expenseLines = [
      makeExpenseLine({ key: 'expense-1', label: 'Groceries' }),
      makeExpenseLine({ key: 'utility-1', label: 'Electricity', dueDate: '2026-03-20' }),
      makeExpenseLine({ key: 'expense-2', label: 'Fuel' }),
    ]
    const items = buildUnifiedList(expenseLines, [], [], 2026, 3)

    expect(items.map((i) => i.key)).toEqual(['utility-1', 'expense-1', 'expense-2'])
  })

  it('treats an unreceived income actual as undated', () => {
    const entries = [makeEntry({ id: 1, receivedOn: null })]
    const incomeLines = [makeIncomeLine({ payDates: [] })]
    const expenseLines = [makeExpenseLine({ dueDate: '2026-03-20' })]

    const items = buildUnifiedList(expenseLines, incomeLines, entries, 2026, 3)

    expect(items.map((i) => i.key)).toEqual(['recurring-bill-1', 'entry-1'])
  })

  it('returns an empty array when there is nothing to show', () => {
    expect(buildUnifiedList([], [], [], 2026, 3)).toEqual([])
  })
})
