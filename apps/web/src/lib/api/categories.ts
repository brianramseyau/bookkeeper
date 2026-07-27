import { api } from '$lib/api'

export interface Category {
  id: number
  name: string
  color: string | null
  sortOrder: number
  budgetAmount: number | null
  /** Number of itemized budget lines - when > 0, budgetAmount is derived from them, not manually set. */
  budgetItemCount: number
  includeInStandardMonth: boolean
  isActive: boolean
  isPaused: boolean
  isArchived: boolean
}

export interface CategoryInput {
  name: string
  color?: string | null
  sortOrder?: number
  budgetAmount?: number | null
  includeInStandardMonth?: boolean
  isActive?: boolean
  isPaused?: boolean
  isArchived?: boolean
}

export function listCategories(opts?: { includeHidden?: boolean }) {
  const query = opts?.includeHidden ? '?includeHidden=true' : ''
  return api.get<Category[]>(`/categories${query}`)
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

export interface CategoryPayment {
  id: number
  categoryId: number
  year: number
  month: number
  paid: boolean
  createdAt: string
  updatedAt: string
}

export function upsertCategoryPayment(
  categoryId: number,
  year: number,
  month: number,
  paid: boolean
) {
  return api.put<CategoryPayment>(`/categories/${categoryId}/payments/${year}/${month}`, { paid })
}
