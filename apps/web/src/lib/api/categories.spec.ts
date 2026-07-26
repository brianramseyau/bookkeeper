import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import { createCategory, deleteCategory, listCategories, updateCategory } from './categories'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('categories api', () => {
  it('lists categories', () => {
    listCategories()
    expect(api.get).toHaveBeenCalledWith('/categories')
  })

  it('creates a category', () => {
    createCategory({ name: 'Groceries' })
    expect(api.post).toHaveBeenCalledWith('/categories', { name: 'Groceries' })
  })

  it('updates a category', () => {
    updateCategory(3, { color: '#fff' })
    expect(api.patch).toHaveBeenCalledWith('/categories/3', { color: '#fff' })
  })

  it('deletes a category', () => {
    deleteCategory(3)
    expect(api.delete).toHaveBeenCalledWith('/categories/3')
  })
})
