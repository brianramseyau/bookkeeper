import { api } from '$lib/api'

export interface Category {
  id: number
  name: string
  color: string | null
  sortOrder: number
  isActive: boolean
  isArchived: boolean
  isSystem: boolean
}

export interface CategoryInput {
  name: string
  color?: string | null
  sortOrder?: number
  isActive?: boolean
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
