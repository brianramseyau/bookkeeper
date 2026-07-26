import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createIncomeEntry,
  createIncomeSource,
  deleteIncomeEntry,
  deleteIncomeSource,
  getIncomeSourcesSummary,
  getIncomeYtd,
  listIncomeEntries,
  listIncomeSources,
  updateIncomeEntry,
  updateIncomeSource,
} from './income'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('income sources api', () => {
  it('lists income sources', () => {
    listIncomeSources()
    expect(api.get).toHaveBeenCalledWith('/income-sources')
  })

  it('creates an income source', () => {
    createIncomeSource({
      userId: 1,
      name: 'Brian Income',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
    expect(api.post).toHaveBeenCalledWith('/income-sources', {
      userId: 1,
      name: 'Brian Income',
      expectedAmount: 5000,
      frequency: 'monthly',
      payDayOfMonth: 14,
    })
  })

  it('updates an income source', () => {
    updateIncomeSource(1, { expectedAmount: 5200 })
    expect(api.patch).toHaveBeenCalledWith('/income-sources/1', { expectedAmount: 5200 })
  })

  it('deletes an income source', () => {
    deleteIncomeSource(1)
    expect(api.delete).toHaveBeenCalledWith('/income-sources/1')
  })

  it('gets the income sources summary', () => {
    getIncomeSourcesSummary()
    expect(api.get).toHaveBeenCalledWith('/income-sources/summary')
  })

  it('gets the year-to-date income for a user/year', () => {
    getIncomeYtd(1, 2026)
    expect(api.get).toHaveBeenCalledWith('/income-sources/ytd?userId=1&year=2026')
  })
})

describe('income entries api', () => {
  it('lists all entries when no filters are given', () => {
    listIncomeEntries()
    expect(api.get).toHaveBeenCalledWith('/income-entries')
  })

  it('lists entries filtered by year only', () => {
    listIncomeEntries(2026)
    expect(api.get).toHaveBeenCalledWith('/income-entries?year=2026')
  })

  it('lists entries filtered by year and month', () => {
    listIncomeEntries(2026, 3)
    expect(api.get).toHaveBeenCalledWith('/income-entries?year=2026&month=3')
  })

  it('creates an income entry', () => {
    createIncomeEntry({ year: 2026, month: 3, amount: 5000 })
    expect(api.post).toHaveBeenCalledWith('/income-entries', { year: 2026, month: 3, amount: 5000 })
  })

  it('updates an income entry', () => {
    updateIncomeEntry(4, { amount: 5100 })
    expect(api.patch).toHaveBeenCalledWith('/income-entries/4', { amount: 5100 })
  })

  it('deletes an income entry', () => {
    deleteIncomeEntry(4)
    expect(api.delete).toHaveBeenCalledWith('/income-entries/4')
  })
})
