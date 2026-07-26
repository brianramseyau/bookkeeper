import { api } from '$lib/api'

export interface CategoryMonthlyActual {
  id: number
  categoryId: number
  occurredOn: string
  amount: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CategoryTrend {
  average: number | null
  latestAmount: number | null
  latestYear: number | null
  latestMonth: number | null
  trend: 'up' | 'down' | 'flat' | null
  months: { year: number; month: number; amount: number }[]
}

export function listCategoryActuals(categoryId: number, year?: number, month?: number) {
  const params = new URLSearchParams()
  if (year) params.set('year', String(year))
  if (month) params.set('month', String(month))
  const query = params.toString() ? `?${params.toString()}` : ''
  return api.get<CategoryMonthlyActual[]>(`/categories/${categoryId}/actuals${query}`)
}

export function getCategoryTrend(categoryId: number) {
  return api.get<CategoryTrend>(`/categories/${categoryId}/trend`)
}

export function createCategoryActual(
  categoryId: number,
  input: { occurredOn: string; amount: number; notes?: string | null }
) {
  return api.post<CategoryMonthlyActual>(`/categories/${categoryId}/actuals`, input)
}

export function updateCategoryActual(
  id: number,
  input: { occurredOn?: string; amount?: number; notes?: string | null }
) {
  return api.patch<CategoryMonthlyActual>(`/category-actuals/${id}`, input)
}

export function deleteCategoryActual(id: number) {
  return api.delete<void>(`/category-actuals/${id}`)
}
