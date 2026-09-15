import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
  upsertExpensePayment,
} from './expenses'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('expenses api', () => {
  it('lists expenses', () => {
    listExpenses()
    expect(api.get).toHaveBeenCalledWith('/expenses')
  })

  it('lists hidden expenses', () => {
    listExpenses({ includeHidden: true })
    expect(api.get).toHaveBeenCalledWith('/expenses?includeHidden=true')
  })

  it('creates an expense', () => {
    createExpense({ name: 'Groceries' })
    expect(api.post).toHaveBeenCalledWith('/expenses', { name: 'Groceries' })
  })

  it('updates an expense', () => {
    updateExpense(3, { name: 'Groceries' })
    expect(api.patch).toHaveBeenCalledWith('/expenses/3', { name: 'Groceries' })
  })

  it('deletes an expense', () => {
    deleteExpense(3)
    expect(api.delete).toHaveBeenCalledWith('/expenses/3')
  })

  it('upserts an expense payment', () => {
    upsertExpensePayment(3, 2026, 7, true)
    expect(api.put).toHaveBeenCalledWith('/expenses/3/payments/2026/7', { paid: true })
  })

  it('gets a single expense', () => {
    getExpense(1)
    expect(api.get).toHaveBeenCalledWith('/expenses/1')
  })
})
