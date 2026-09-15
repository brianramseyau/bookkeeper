import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExpenseDetailPage from './+page.svelte'

vi.mock('$app/state', () => ({ page: { params: { expenseId: '1' } } }))
vi.mock('$lib/api/expenses', () => ({
  getExpense: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Groceries',
    sortOrder: 0,
    budgetAmount: 800,
    budgetItemCount: 0,
    isRecurring: true,
    excludeFromBudget: false,
    categoryId: null,
    isActive: true,
    isPaused: false,
    isArchived: false,
  }),
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))
vi.mock('$lib/api/expense-actuals', () => ({
  listExpenseActuals: vi.fn().mockResolvedValue([]),
  getExpenseTrend: vi.fn().mockResolvedValue({
    average: 780,
    latestAmount: 800,
    latestYear: 2026,
    latestMonth: 3,
    trend: 'up',
    months: [{ year: 2026, month: 3, amount: 800 }],
  }),
  createExpenseActual: vi.fn(),
  updateExpenseActual: vi.fn(),
  deleteExpenseActual: vi.fn(),
}))
vi.mock('$lib/api/expense-budget-items', () => ({
  listExpenseBudgetItems: vi.fn().mockResolvedValue([]),
  createExpenseBudgetItem: vi.fn(),
  updateExpenseBudgetItem: vi.fn(),
  deleteExpenseBudgetItem: vi.fn(),
}))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn().mockResolvedValue([]) }))

beforeEach(() => vi.clearAllMocks())

describe('Expense detail page', () => {
  it('renders the shared detail view plus the budget breakdown', async () => {
    render(ExpenseDetailPage)

    expect(await screen.findByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
    expect(await screen.findByText('Budget breakdown')).toBeInTheDocument()
  })
})
