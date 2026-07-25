import { api } from '$lib/api'

export interface Category {
  id: number
  name: string
  color: string | null
  sortOrder: number
  budgetAmount: number | null
  includeInStandardMonth: boolean
  isActive: boolean
}

export interface CategoryInput {
  name: string
  color?: string | null
  sortOrder?: number
  budgetAmount?: number | null
  includeInStandardMonth?: boolean
}

export function listCategories() {
  return api.get<Category[]>('/categories')
}

export function createCategory(input: CategoryInput) {
  return api.post<Category>('/categories', input)
}

export function updateCategory(id: number, input: Partial<CategoryInput>) {
  return api.patch<Category>(`/categories/${id}`, input)
}

export function deleteCategory(id: number) {
  return api.delete<void>(`/categories/${id}`)
}
