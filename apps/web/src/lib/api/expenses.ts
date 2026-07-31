import { api } from '$lib/api'

export interface Expense {
  id: number
  name: string
  sortOrder: number
  budgetAmount: number | null
  /** Number of itemized budget lines - when > 0, budgetAmount is derived from them, not manually set. */
  budgetItemCount: number
  isRecurring: boolean
  /** Hides this expense from Monthly (and the Dashboard trend) entirely - e.g. Credit Card, whose spend already shows up under other expenses. */
  excludeFromBudget: boolean
  categoryId: number | null
  isActive: boolean
  isPaused: boolean
  isArchived: boolean
}

export interface ExpenseInput {
  name: string
  sortOrder?: number
  budgetAmount?: number | null
  isRecurring?: boolean
  excludeFromBudget?: boolean
  categoryId?: number | null
  isActive?: boolean
  isPaused?: boolean
  isArchived?: boolean
}

export function listExpenses(opts?: { includeHidden?: boolean }) {
  const query = opts?.includeHidden ? '?includeHidden=true' : ''
  return api.get<Expense[]>(`/expenses${query}`)
}

export function createExpense(input: ExpenseInput) {
  return api.post<Expense>('/expenses', input)
}

export function updateExpense(id: number, input: Partial<ExpenseInput>) {
  return api.patch<Expense>(`/expenses/${id}`, input)
}

export function deleteExpense(id: number) {
  return api.delete<void>(`/expenses/${id}`)
}

export interface ExpensePayment {
  id: number
  expenseId: number
  year: number
  month: number
  paid: boolean
  createdAt: string
  updatedAt: string
}

export function upsertExpensePayment(
  expenseId: number,
  year: number,
  month: number,
  paid: boolean
) {
  return api.put<ExpensePayment>(`/expenses/${expenseId}/payments/${year}/${month}`, { paid })
}
