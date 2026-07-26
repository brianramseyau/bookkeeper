import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createCategoryBudgetItem,
  deleteCategoryBudgetItem,
  listCategoryBudgetItems,
  updateCategoryBudgetItem,
} from './category-budget-items'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('category budget items api', () => {
  it('lists budget items for a category', () => {
    listCategoryBudgetItems(1)
    expect(api.get).toHaveBeenCalledWith('/categories/1/budget-items')
  })

  it('creates a budget item', () => {
    createCategoryBudgetItem(1, { name: 'Rent', amount: 2000 })
    expect(api.post).toHaveBeenCalledWith('/categories/1/budget-items', {
      name: 'Rent',
      amount: 2000,
    })
  })

  it('updates a budget item', () => {
    updateCategoryBudgetItem(5, { amount: 2100 })
    expect(api.patch).toHaveBeenCalledWith('/category-budget-items/5', { amount: 2100 })
  })

  it('deletes a budget item', () => {
    deleteCategoryBudgetItem(5)
    expect(api.delete).toHaveBeenCalledWith('/category-budget-items/5')
  })
})
