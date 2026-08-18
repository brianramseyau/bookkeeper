import { test } from '@japa/runner'
import type IncomeEntry from '#models/income_entry'
import { netIncomeForEntries } from '#services/income_netting'

function fakeEntry(overrides: Partial<IncomeEntry>): IncomeEntry {
  return {
    incomeSourceId: null,
    userId: null,
    year: 2026,
    month: 8,
    amount: 0,
    taxWithheld: null,
    ...overrides,
  } as IncomeEntry
}

test.group('netIncomeForEntries', () => {
  test('counts a salary (source-tied) entry at its full amount', ({ assert }) => {
    const entry = fakeEntry({ incomeSourceId: 1, userId: null, amount: 5000 })
    assert.equal(netIncomeForEntries([entry], new Map()), 5000)
  })

  test('counts a tax-withheld other entry at its full amount', ({ assert }) => {
    const entry = fakeEntry({ userId: 1, amount: 300, taxWithheld: true })
    assert.equal(netIncomeForEntries([entry], new Map()), 300)
  })

  test('nets an untaxed other entry through the owner’s rate for its financial year', ({
    assert,
  }) => {
    const entry = fakeEntry({ userId: 1, year: 2026, month: 8, amount: 1000, taxWithheld: false })
    const rates = new Map([['1:2027', 0.37]])
    assert.equal(netIncomeForEntries([entry], rates), 630)
  })

  test('uses the entry’s financial year (not the calendar year) to look up the rate', ({
    assert,
  }) => {
    const entry = fakeEntry({ userId: 1, year: 2026, month: 2, amount: 1000, taxWithheld: false })
    const rates = new Map([['1:2026', 0.3]])
    assert.equal(netIncomeForEntries([entry], rates), 700)
  })

  test('falls back to the gross sale when no rate is set', ({ assert }) => {
    const entry = fakeEntry({ userId: 1, amount: 1000, taxWithheld: false })
    assert.equal(netIncomeForEntries([entry], new Map()), 1000)
  })

  test('falls back to the gross sale when the entry has no owner', ({ assert }) => {
    const entry = fakeEntry({ userId: null, amount: 1000, taxWithheld: false })
    assert.equal(netIncomeForEntries([entry], new Map()), 1000)
  })

  test('sums entries and rounds to cents', ({ assert }) => {
    const entries = [
      fakeEntry({ incomeSourceId: 1, amount: 5000 }),
      fakeEntry({ userId: 1, amount: 1000, taxWithheld: false }),
    ]
    const rates = new Map([['1:2027', 0.325]])
    assert.equal(netIncomeForEntries(entries, rates), 5675)
  })
})
