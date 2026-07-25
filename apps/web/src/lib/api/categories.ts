import { api } from '$lib/api'

export interface Category {
  id: number
  name: string
  color: string | null
  sortOrder: number
  isActive: boolean
}

export function listCategories() {
  return api.get<Category[]>('/categories')
}
