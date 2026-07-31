import { api } from '$lib/api'

export interface ExpenseMonthlyActual {
  id: number
  expenseId: number
  occurredOn: string
  amount: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseTrend {
  average: number | null
  latestAmount: number | null
  latestYear: number | null
  latestMonth: number | null
  trend: 'up' | 'down' | 'flat' | null
  months: { year: number; month: number; amount: number }[]
}

export function listExpenseActuals(expenseId: number, year?: number, month?: number) {
  const params = new URLSearchParams()
  if (year) params.set('year', String(year))
  if (month) params.set('month', String(month))
  const query = params.toString() ? `?${params.toString()}` : ''
  return api.get<ExpenseMonthlyActual[]>(`/expenses/${expenseId}/actuals${query}`)
}

export function getExpenseTrend(expenseId: number) {
  return api.get<ExpenseTrend>(`/expenses/${expenseId}/trend`)
}

export function createExpenseActual(
  expenseId: number,
  input: { occurredOn: string; amount: number; notes?: string | null }
) {
  return api.post<ExpenseMonthlyActual>(`/expenses/${expenseId}/actuals`, input)
}

export function updateExpenseActual(
  id: number,
  input: { occurredOn?: string; amount?: number; notes?: string | null }
) {
  return api.patch<ExpenseMonthlyActual>(`/expense-actuals/${id}`, input)
}

export function deleteExpenseActual(id: number) {
  return api.delete<void>(`/expense-actuals/${id}`)
}
