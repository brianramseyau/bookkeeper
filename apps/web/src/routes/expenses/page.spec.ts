import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExpensesPage from './+page.svelte'

vi.mock('$lib/api/expenses', () => ({
  listExpenses: vi.fn().mockResolvedValue([]),
  getExpense: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))
vi.mock('$lib/api/expense-actuals', () => ({ getExpenseTrend: vi.fn() }))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn().mockResolvedValue([]) }))

beforeEach(() => vi.clearAllMocks())

describe('Expenses page', () => {
  it('renders the shared outgoings list', async () => {
    render(ExpensesPage)

    expect(await screen.findByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
  })
})
