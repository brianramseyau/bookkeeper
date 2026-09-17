import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '$lib/api'
import type { Expense } from '$lib/api/expenses'
import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
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
vi.mock('$lib/components/app/confirmDestructive.svelte', () => ({
  confirmDestructive: vi.fn(),
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

  it('adds a budget item through the form sheet, then notifies the parent', async () => {
    vi.mocked(itemsApi.createExpenseBudgetItem).mockResolvedValue(budgetItem)
    const { onChanged } = renderBreakdown()
    await screen.findByText('Insurance')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Add budget item' }))
    await fireEvent.input(screen.getByLabelText('Item'), { target: { value: 'Food' } })
    await fireEvent.input(screen.getByLabelText('Amount'), { target: { value: '50' } })
    await fireEvent.submit(document.querySelector('#budget-item-form')!)

    await waitFor(() =>
      expect(itemsApi.createExpenseBudgetItem).toHaveBeenCalledWith(1, { name: 'Food', amount: 50 })
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('validates a budget item name and amount', async () => {
    renderBreakdown()
    await screen.findByText('Insurance')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Add budget item' }))
    await fireEvent.submit(document.querySelector('#budget-item-form')!)

    expect(await screen.findByText('Name and amount are required')).toBeInTheDocument()
  })

  it('edits an existing budget item through the form sheet', async () => {
    vi.mocked(itemsApi.updateExpenseBudgetItem).mockResolvedValue(budgetItem)
    renderBreakdown()
    await screen.findByText('Insurance')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: 'Actions for Insurance' })[0]!)
    await user.click(screen.getByText('Edit'))
    await fireEvent.input(screen.getByDisplayValue('40'), { target: { value: '55' } })
    await fireEvent.submit(document.querySelector('#budget-item-form')!)

    await waitFor(() =>
      expect(itemsApi.updateExpenseBudgetItem).toHaveBeenCalledWith(7, {
        name: 'Insurance',
        amount: 55,
      })
    )
  })

  it('deletes a budget item after confirmation', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(true)
    vi.mocked(itemsApi.deleteExpenseBudgetItem).mockResolvedValue(undefined)
    renderBreakdown()
    await screen.findByText('Insurance')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: 'Actions for Insurance' })[0]!)
    await user.click(screen.getByText('Delete'))

    await waitFor(() => expect(itemsApi.deleteExpenseBudgetItem).toHaveBeenCalledWith(7))
  })

  it('does not delete a budget item when the confirmation is declined', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(false)
    renderBreakdown()
    await screen.findByText('Insurance')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: 'Actions for Insurance' })[0]!)
    await user.click(screen.getByText('Delete'))

    await waitFor(() => expect(confirmDestructive).toHaveBeenCalled())
    expect(itemsApi.deleteExpenseBudgetItem).not.toHaveBeenCalled()
  })

  it('edits an existing monthly actual through the form sheet', async () => {
    vi.mocked(actualsApi.updateExpenseActual).mockResolvedValue(actual)
    renderBreakdown()
    await screen.findByText('vet')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: 'Actions for the Mar 2026 entry' })[0]!)
    await user.click(screen.getByText('Edit'))
    await fireEvent.input(screen.getByDisplayValue('80'), { target: { value: '85' } })
    await fireEvent.submit(document.querySelector('#expense-actual-form')!)

    await waitFor(() => expect(actualsApi.updateExpenseActual).toHaveBeenCalled())
  })

  it('requires a month and amount before adding an actual', async () => {
    renderBreakdown()
    await screen.findByText('vet')
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Add monthly entry' }))
    await fireEvent.submit(document.querySelector('#expense-actual-form')!)

    expect(await screen.findByText('Month and amount are required')).toBeInTheDocument()
  })

  it('closes the budget item sheet from the Cancel button without saving', async () => {
    renderBreakdown()
    await screen.findByText('Insurance')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: 'Actions for Insurance' })[0]!)
    await user.click(screen.getByText('Edit'))
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Item')).not.toBeInTheDocument()
    expect(itemsApi.updateExpenseBudgetItem).not.toHaveBeenCalled()
  })

  it('closes the actual sheet from the Cancel button without saving', async () => {
    renderBreakdown()
    await screen.findByText('vet')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: 'Actions for the Mar 2026 entry' })[0]!)
    await user.click(screen.getByText('Edit'))
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument()
    expect(actualsApi.updateExpenseActual).not.toHaveBeenCalled()
  })

  it('deletes a monthly actual after confirmation', async () => {
    vi.mocked(confirmDestructive).mockResolvedValue(true)
    vi.mocked(actualsApi.deleteExpenseActual).mockResolvedValue(undefined)
    renderBreakdown()
    await screen.findByText('vet')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: 'Actions for the Mar 2026 entry' })[0]!)
    await user.click(screen.getByText('Delete'))

    await waitFor(() => expect(actualsApi.deleteExpenseActual).toHaveBeenCalledWith(5))
  })

  it('shows a load error', async () => {
    vi.mocked(actualsApi.listExpenseActuals).mockRejectedValue(new ApiError(500, 'Boom') as never)
    renderBreakdown()

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })
})
