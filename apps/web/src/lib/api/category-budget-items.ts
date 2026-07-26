import { api } from '$lib/api'

export interface CategoryBudgetItem {
  id: number
  categoryId: number
  name: string
  amount: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export function listCategoryBudgetItems(categoryId: number) {
  return api.get<CategoryBudgetItem[]>(`/categories/${categoryId}/budget-items`)
}

export function createCategoryBudgetItem(
  categoryId: number,
  input: { name: string; amount: number; notes?: string | null }
) {
  return api.post<CategoryBudgetItem>(`/categories/${categoryId}/budget-items`, input)
}

export function updateCategoryBudgetItem(
  id: number,
  input: { name?: string; amount?: number; notes?: string | null }
) {
  return api.patch<CategoryBudgetItem>(`/category-budget-items/${id}`, input)
}

export function deleteCategoryBudgetItem(id: number) {
  return api.delete<void>(`/category-budget-items/${id}`)
}
