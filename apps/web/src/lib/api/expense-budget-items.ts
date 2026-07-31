import { api } from '$lib/api'

export interface ExpenseBudgetItem {
  id: number
  expenseId: number
  name: string
  amount: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export function listExpenseBudgetItems(expenseId: number) {
  return api.get<ExpenseBudgetItem[]>(`/expenses/${expenseId}/budget-items`)
}

export function createExpenseBudgetItem(
  expenseId: number,
  input: { name: string; amount: number; notes?: string | null }
) {
  return api.post<ExpenseBudgetItem>(`/expenses/${expenseId}/budget-items`, input)
}

export function updateExpenseBudgetItem(
  id: number,
  input: { name?: string; amount?: number; notes?: string | null }
) {
  return api.patch<ExpenseBudgetItem>(`/expense-budget-items/${id}`, input)
}

export function deleteExpenseBudgetItem(id: number) {
  return api.delete<void>(`/expense-budget-items/${id}`)
}
