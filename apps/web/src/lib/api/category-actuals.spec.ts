import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createCategoryActual,
  deleteCategoryActual,
  getCategoryTrend,
  listCategoryActuals,
  updateCategoryActual,
} from './category-actuals'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('category actuals api', () => {
  it('lists actuals with no filters', () => {
    listCategoryActuals(1)
    expect(api.get).toHaveBeenCalledWith('/categories/1/actuals')
  })

  it('lists actuals filtered by year only', () => {
    listCategoryActuals(1, 2026)
    expect(api.get).toHaveBeenCalledWith('/categories/1/actuals?year=2026')
  })

  it('lists actuals filtered by year and month', () => {
    listCategoryActuals(1, 2026, 3)
    expect(api.get).toHaveBeenCalledWith('/categories/1/actuals?year=2026&month=3')
  })

  it('gets a category trend', () => {
    getCategoryTrend(1)
    expect(api.get).toHaveBeenCalledWith('/categories/1/trend')
  })

  it('creates a category actual', () => {
    createCategoryActual(1, { occurredOn: '2026-03-01', amount: 50 })
    expect(api.post).toHaveBeenCalledWith('/categories/1/actuals', {
      occurredOn: '2026-03-01',
      amount: 50,
    })
  })

  it('updates a category actual', () => {
    updateCategoryActual(7, { amount: 60 })
    expect(api.patch).toHaveBeenCalledWith('/category-actuals/7', { amount: 60 })
  })

  it('deletes a category actual', () => {
    deleteCategoryActual(7)
    expect(api.delete).toHaveBeenCalledWith('/category-actuals/7')
  })
})
