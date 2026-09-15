import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '$lib/api'
import type { Expense } from '$lib/api/expenses'
import ExpenseBreakdown from './ExpenseBreakdown.svelte'

vi.mock('$lib/api/expense-actuals', () => ({
  listExpenseActuals: vi.fn(),
  createExpenseActual: vi.fn(),
  updateExpenseActual: vi.fn(),
  deleteExpenseActual: vi.fn(),
}))
vi.mock('$lib/api/expense-budget-items', () => ({
  listExpenseBudgetItems: vi.fn(),
  createExpenseBudgetItem: vi.fn(),
  updateExpenseBudgetItem: vi.fn(),
  deleteExpenseBudgetItem: vi.fn(),
}))

import * as actualsApi from '$lib/api/expense-actuals'
import * as itemsApi from '$lib/api/expense-budget-items'

const expense = { id: 1, name: 'Dog', budgetAmount: 100, budgetItemCount: 0 } as Expense

const actual = {
  id: 5,
  expenseId: 1,
  occurredOn: '2026-03-31T00:00:00.000Z',
  amount: 80,
  notes: 'vet',
  createdAt: '',
  updatedAt: '',
}
const budgetItem = {
  id: 7,
  expenseId: 1,
  name: 'Insurance',
  amount: 40,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(actualsApi.listExpenseActuals).mockResolvedValue([actual])
  vi.mocked(itemsApi.listExpenseBudgetItems).mockResolvedValue([budgetItem])
})

function renderBreakdown(onChanged = vi.fn().mockResolvedValue(undefined)) {
  render(ExpenseBreakdown, { props: { expenseId: 1, expense, onChanged } })
  return { onChanged }
}

describe('ExpenseBreakdown', () => {
  it('lists budget items with a total, and monthly actuals', async () => {
    renderBreakdown()

    expect(await screen.findByText('Insurance')).toBeInTheDocument()
    expect(screen.getAllByText('$40.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Mar 2026')).toBeInTheDocument()
    expect(screen.getByText('vet')).toBeInTheDocument()
  })

  it('warns when a manually-set budget has no items yet', async () => {
    vi.mocked(itemsApi.listExpenseBudgetItems).mockResolvedValue([])
    renderBreakdown()

    expect(await screen.findByText(/manually-set budget/)).toBeInTheDocument()
  })

  it('adds a budget item, then notifies the parent', async () => {
    vi.mocked(itemsApi.createExpenseBudgetItem).mockResolvedValue(budgetItem)
    const { onChanged } = renderBreakdown()
    await screen.findByText('Insurance')
    const user = userEvent.setup()

    const form = screen.getByPlaceholderText('e.g. Insurance').closest('form')!
    await user.type(within(form).getByLabelText('Amount'), '50')
    await user.type(screen.getByPlaceholderText('e.g. Insurance'), 'Food')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    await waitFor(() =>
      expect(itemsApi.createExpenseBudgetItem).toHaveBeenCalledWith(1, { name: 'Food', amount: 50 })
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('validates a budget item name and amount', async () => {
    renderBreakdown()
    await screen.findByText('Insurance')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Add item' }))

    expect(await screen.findByText('Name and amount are required')).toBeInTheDocument()
  })

  it('edits an existing budget item', async () => {
    vi.mocked(itemsApi.updateExpenseBudgetItem).mockResolvedValue(budgetItem)
    renderBreakdown()
    await screen.findByText('Insurance')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Edit Insurance' }))
    await fireEvent.input(screen.getByDisplayValue('40'), { target: { value: '55' } })
    await user.click(screen.getByRole('button', { name: 'Save Insurance' }))

    await waitFor(() =>
      expect(itemsApi.updateExpenseBudgetItem).toHaveBeenCalledWith(7, {
        name: 'Insurance',
        amount: 55,
      })
    )
  })

  it('deletes a budget item', async () => {
    vi.mocked(itemsApi.deleteExpenseBudgetItem).mockResolvedValue(undefined)
    renderBreakdown()
    await screen.findByText('Insurance')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Insurance' }))

    await waitFor(() => expect(itemsApi.deleteExpenseBudgetItem).toHaveBeenCalledWith(7))
  })

  it('edits an existing monthly actual', async () => {
    vi.mocked(actualsApi.updateExpenseActual).mockResolvedValue(actual)
    renderBreakdown()
    await screen.findByText('vet')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /Edit entry from/ }))
    await fireEvent.input(screen.getByDisplayValue('80'), { target: { value: '85' } })
    await user.click(screen.getByRole('button', { name: /Save entry from/ }))

    await waitFor(() => expect(actualsApi.updateExpenseActual).toHaveBeenCalled())
  })

  it('requires a month and amount before adding an actual, and deletes one', async () => {
    vi.mocked(actualsApi.deleteExpenseActual).mockResolvedValue(undefined)
    renderBreakdown()
    await screen.findByText('vet')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Add entry' }))
    expect(await screen.findByText('Month and amount are required')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Delete entry from/ }))
    await waitFor(() => expect(actualsApi.deleteExpenseActual).toHaveBeenCalledWith(5))
  })

  it('shows a load error', async () => {
    vi.mocked(actualsApi.listExpenseActuals).mockRejectedValue(new ApiError(500, 'Boom') as never)
    renderBreakdown()

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })
})
