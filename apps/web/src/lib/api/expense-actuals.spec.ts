import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createExpenseActual,
  deleteExpenseActual,
  getExpenseTrend,
  listExpenseActuals,
  updateExpenseActual,
} from './expense-actuals'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('expense actuals api', () => {
  it('lists actuals with no filters', () => {
    listExpenseActuals(1)
    expect(api.get).toHaveBeenCalledWith('/expenses/1/actuals')
  })

  it('lists actuals filtered by year only', () => {
    listExpenseActuals(1, 2026)
    expect(api.get).toHaveBeenCalledWith('/expenses/1/actuals?year=2026')
  })

  it('lists actuals filtered by year and month', () => {
    listExpenseActuals(1, 2026, 3)
    expect(api.get).toHaveBeenCalledWith('/expenses/1/actuals?year=2026&month=3')
  })

  it('gets an expense trend', () => {
    getExpenseTrend(1)
    expect(api.get).toHaveBeenCalledWith('/expenses/1/trend')
  })

  it('creates an expense actual', () => {
    createExpenseActual(1, { occurredOn: '2026-03-01', amount: 50 })
    expect(api.post).toHaveBeenCalledWith('/expenses/1/actuals', {
      occurredOn: '2026-03-01',
      amount: 50,
    })
  })

  it('updates an expense actual', () => {
    updateExpenseActual(7, { amount: 60 })
    expect(api.patch).toHaveBeenCalledWith('/expense-actuals/7', { amount: 60 })
  })

  it('deletes an expense actual', () => {
    deleteExpenseActual(7)
    expect(api.delete).toHaveBeenCalledWith('/expense-actuals/7')
  })
})
