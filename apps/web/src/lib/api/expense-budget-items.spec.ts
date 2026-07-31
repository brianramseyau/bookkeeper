import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createExpenseBudgetItem,
  deleteExpenseBudgetItem,
  listExpenseBudgetItems,
  updateExpenseBudgetItem,
} from './expense-budget-items'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('expense budget items api', () => {
  it('lists budget items for an expense', () => {
    listExpenseBudgetItems(1)
    expect(api.get).toHaveBeenCalledWith('/expenses/1/budget-items')
  })

  it('creates a budget item', () => {
    createExpenseBudgetItem(1, { name: 'Rent', amount: 2000 })
    expect(api.post).toHaveBeenCalledWith('/expenses/1/budget-items', {
      name: 'Rent',
      amount: 2000,
    })
  })

  it('updates a budget item', () => {
    updateExpenseBudgetItem(5, { amount: 2100 })
    expect(api.patch).toHaveBeenCalledWith('/expense-budget-items/5', { amount: 2100 })
  })

  it('deletes a budget item', () => {
    deleteExpenseBudgetItem(5)
    expect(api.delete).toHaveBeenCalledWith('/expense-budget-items/5')
  })
})
