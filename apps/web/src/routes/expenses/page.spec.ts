import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  type Expense,
} from '$lib/api/expenses'
import { getExpenseTrend, type ExpenseTrend } from '$lib/api/expense-actuals'
import { listCategories, type Category } from '$lib/api/categories'
import { ApiError } from '$lib/api'
import ExpensesPage from './+page.svelte'

vi.mock('$lib/api/expenses', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))

vi.mock('$lib/api/expense-actuals', () => ({
  getExpenseTrend: vi.fn(),
}))

vi.mock('$lib/api/categories', () => ({
  listCategories: vi.fn(),
}))

const groceries: Expense = {
  id: 1,
  name: 'Groceries',
  sortOrder: 1,
  budgetAmount: 400,
  budgetItemCount: 0,
  isRecurring: true,
  excludeFromBudget: false,
  categoryId: null,
  isActive: true,
  isPaused: false,
  isArchived: false,
}

const rent: Expense = {
  id: 2,
  name: 'Rent',
  sortOrder: 2,
  budgetAmount: 2000,
  budgetItemCount: 3,
  isRecurring: false,
  excludeFromBudget: false,
  categoryId: null,
  isActive: true,
  isPaused: false,
  isArchived: false,
}

const creditCard: Expense = {
  id: 3,
  name: 'Credit Card',
  sortOrder: 3,
  budgetAmount: null,
  budgetItemCount: 0,
  isRecurring: true,
  excludeFromBudget: true,
  categoryId: null,
  isActive: true,
  isPaused: false,
  isArchived: false,
}

const foodCategory: Category = {
  id: 10,
  name: 'Food',
  color: null,
  sortOrder: 0,

  parentId: null,
  isActive: true,
  isArchived: false,
  isSystem: false,
}

const noTrend: ExpenseTrend = {
  average: null,
  latestAmount: null,
  latestYear: null,
  latestMonth: null,
  trend: null,
  months: [],
}

describe('expenses page', () => {
  beforeEach(() => {
    vi.mocked(listExpenses).mockReset()
    vi.mocked(createExpense).mockReset()
    vi.mocked(updateExpense).mockReset()
    vi.mocked(deleteExpense).mockReset()
    vi.mocked(getExpenseTrend).mockReset()
    vi.mocked(listCategories).mockReset()
    vi.mocked(listCategories).mockResolvedValue([])
  })

  it('shows a loading state, then an error on failure', async () => {
    vi.mocked(listExpenses).mockRejectedValue(new ApiError(500, 'Could not load expenses'))
    render(ExpensesPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Could not load expenses')).toBeInTheDocument()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(listExpenses).mockRejectedValue(new Error('boom'))
    render(ExpensesPage)
    expect(await screen.findByText('Failed to load expenses')).toBeInTheDocument()
  })

  it('shows an empty table when there are no expenses', async () => {
    vi.mocked(listExpenses).mockResolvedValue([])
    render(ExpensesPage)

    await screen.findByPlaceholderText('Add an expense (e.g. Groceries)')
    expect(screen.queryByText('Groceries')).toBeNull()
  })

  it('renders expenses with budget, trend and standard-month indicators', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries, rent, creditCard])
    vi.mocked(getExpenseTrend).mockImplementation((id) =>
      Promise.resolve(
        id === groceries.id
          ? {
              average: 350,
              latestAmount: 380,
              latestYear: 2026,
              latestMonth: 6,
              trend: 'up',
              months: [],
            }
          : noTrend
      )
    )
    render(ExpensesPage)

    const link = await screen.findByRole('link', { name: /Groceries/ })
    expect(link.getAttribute('href')).toBe('/expenses/1')
    expect(screen.getByTitle('Trending up')).toBeInTheDocument()
    expect(screen.getByText('▲')).toBeInTheDocument()
    expect(screen.getByText('$380.00')).toBeInTheDocument()
    expect(screen.getByText('$350.00')).toBeInTheDocument()

    // Rent is itemized, so its budget shows a derived-value marker.
    expect(screen.getByTitle('Derived from 3 itemized budget line(s)')).toBeInTheDocument()

    // Rent isn't Recurring and Credit Card is flagged to ignore from
    // budget - both are called out under their name; Groceries (the
    // all-defaults case) gets no status line at all.
    expect(screen.getByText('adhoc expense')).toBeInTheDocument()
    expect(screen.getByText('ignored from budget')).toBeInTheDocument()
  })

  it('toggles the ignore-budget checkbox and saves it', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Groceries' }))[0]!)

    const ignoreCheckbox = screen.getByRole('checkbox', {
      name: 'Ignore budget',
    }) as HTMLInputElement
    expect(ignoreCheckbox.checked).toBe(false)
    await user.click(ignoreCheckbox)

    await user.click(screen.getAllByRole('button', { name: 'Save Groceries' })[0]!)

    expect(updateExpense).toHaveBeenCalledWith(1, {
      name: 'Groceries',
      budgetAmount: 400,
      isRecurring: true,
      excludeFromBudget: true,
    })
  })

  it('shows a flat trend caret', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue({
      average: 100,
      latestAmount: 100,
      latestYear: 2026,
      latestMonth: 6,
      trend: 'flat',
      months: [],
    })
    render(ExpensesPage)

    expect(await screen.findByTitle('Flat')).toBeInTheDocument()
  })

  it('shows a down trend caret', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue({
      average: 100,
      latestAmount: 80,
      latestYear: 2026,
      latestMonth: 6,
      trend: 'down',
      months: [],
    })
    render(ExpensesPage)

    expect(await screen.findByTitle('Trending down')).toBeInTheDocument()
  })

  it('renders a category select in edit mode and calls updateExpense with the chosen categoryId', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(listCategories).mockResolvedValue([foodCategory])
    vi.mocked(updateExpense).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(ExpensesPage)

    expect(screen.queryByRole('combobox')).toBeNull()
    await user.click((await screen.findAllByRole('button', { name: 'Edit Groceries' }))[0]!)

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '10')

    expect(updateExpense).toHaveBeenCalledWith(1, { categoryId: 10 })
  })

  it('shows the category name under the expense name outside edit mode', async () => {
    vi.mocked(listExpenses).mockResolvedValue([{ ...groceries, categoryId: 10 }])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(listCategories).mockResolvedValue([foodCategory])
    render(ExpensesPage)

    expect(await screen.findByText('Food')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('adds a new expense and reloads the list', async () => {
    vi.mocked(listExpenses).mockResolvedValue([])
    vi.mocked(createExpense).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(ExpensesPage)

    await screen.findByPlaceholderText('Add an expense (e.g. Groceries)')
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)

    await user.type(screen.getByPlaceholderText('Add an expense (e.g. Groceries)'), 'Groceries')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(createExpense).toHaveBeenCalledWith({ name: 'Groceries' })
    expect(await screen.findByText('Groceries')).toBeInTheDocument()
  })

  it('does not submit an empty or whitespace-only expense name', async () => {
    vi.mocked(listExpenses).mockResolvedValue([])
    const user = userEvent.setup()
    render(ExpensesPage)

    await screen.findByPlaceholderText('Add an expense (e.g. Groceries)')
    await user.type(screen.getByPlaceholderText('Add an expense (e.g. Groceries)'), '   ')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(createExpense).not.toHaveBeenCalled()
  })

  it('shows an error when adding an expense fails', async () => {
    vi.mocked(listExpenses).mockResolvedValue([])
    vi.mocked(createExpense).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.type(
      await screen.findByPlaceholderText('Add an expense (e.g. Groceries)'),
      'Groceries'
    )
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(await screen.findByText('Name already exists')).toBeInTheDocument()
  })

  it('edits a non-itemized expense, including its budget amount', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockResolvedValue({ ...groceries, name: 'Food' })
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Groceries' }))[0]!)

    const nameInput = screen.getByDisplayValue('Groceries')
    await user.clear(nameInput)
    await user.type(nameInput, 'Food')

    const budgetInput = screen.getByPlaceholderText('—') as HTMLInputElement
    await user.clear(budgetInput)
    await user.type(budgetInput, '450')

    const recurringCheckbox = screen.getByRole('checkbox', {
      name: 'Recurring',
    }) as HTMLInputElement
    expect(recurringCheckbox.checked).toBe(true)
    await user.click(recurringCheckbox)

    vi.mocked(listExpenses).mockResolvedValue([{ ...groceries, name: 'Food' }])

    await user.click(screen.getAllByRole('button', { name: 'Save Groceries' })[0]!)

    expect(updateExpense).toHaveBeenCalledWith(1, {
      name: 'Food',
      budgetAmount: 450,
      isRecurring: false,
      excludeFromBudget: false,
    })
    expect(await screen.findByText('Food')).toBeInTheDocument()
  })

  it('does not send budgetAmount when editing an itemized expense', async () => {
    vi.mocked(listExpenses).mockResolvedValue([rent])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockResolvedValue(rent)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Rent' }))[0]!)
    await user.click(screen.getAllByRole('button', { name: 'Save Rent' })[0]!)

    expect(updateExpense).toHaveBeenCalledWith(2, {
      name: 'Rent',
      isRecurring: false,
      excludeFromBudget: false,
    })
  })

  it('cancels an in-progress edit without saving', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Groceries' }))[0]!)
    const nameInput = screen.getByDisplayValue('Groceries')
    await user.clear(nameInput)
    await user.type(nameInput, 'Should not save')
    await user.click(screen.getAllByRole('button', { name: 'Cancel editing Groceries' })[0]!)

    expect(updateExpense).not.toHaveBeenCalled()
    expect(await screen.findByText('Groceries')).toBeInTheDocument()
  })

  it('requires a name when saving an edit', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Groceries' }))[0]!)
    const nameInput = screen.getByDisplayValue('Groceries')
    await user.clear(nameInput)
    await user.click(screen.getAllByRole('button', { name: 'Save Groceries' })[0]!)

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(updateExpense).not.toHaveBeenCalled()
  })

  it('shows an error when saving an edit fails', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockRejectedValue(new ApiError(500, 'Could not save changes'))
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit Groceries' }))[0]!)
    await user.click(screen.getAllByRole('button', { name: 'Save Groceries' })[0]!)

    expect(await screen.findByText('Could not save changes')).toBeInTheDocument()
  })

  it('does not offer Remove on an active or paused expense, only once archived', async () => {
    vi.mocked(listExpenses).mockResolvedValue([{ ...groceries, isPaused: true }])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Groceries')
    expect(screen.queryByRole('button', { name: 'Delete Groceries' })).toBeNull()
  })

  it('permanently removes an archived expense after confirming', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listExpenses).mockResolvedValue([archived, rent])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(deleteExpense).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Groceries')
    vi.mocked(listExpenses).mockResolvedValue([rent])
    await user.click(screen.getAllByRole('button', { name: 'Delete Groceries' })[0]!)

    expect(window.confirm).toHaveBeenCalledWith(
      'Permanently delete "Groceries"? This cannot be undone.'
    )
    expect(deleteExpense).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Groceries')).toBeNull())
  })

  it('does not remove an archived expense when the confirmation is declined', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listExpenses).mockResolvedValue([archived])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await user.click((await screen.findAllByRole('button', { name: 'Delete Groceries' }))[0]!)

    expect(deleteExpense).not.toHaveBeenCalled()
  })

  it('shows an error when permanently removing fails', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listExpenses).mockResolvedValue([archived])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(deleteExpense).mockRejectedValue(new ApiError(500, 'Failed to remove'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await user.click((await screen.findAllByRole('button', { name: 'Delete Groceries' }))[0]!)

    expect(await screen.findByText('Failed to remove')).toBeInTheDocument()
  })

  it('pauses an expense and reveals it under "Show paused / archived / removed"', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockResolvedValue({ ...groceries, isPaused: true })
    const user = userEvent.setup()
    render(ExpensesPage)

    await screen.findByText('Groceries')
    vi.mocked(listExpenses).mockResolvedValue([{ ...groceries, isPaused: true }])
    await user.click(screen.getAllByRole('button', { name: 'Pause Groceries' })[0]!)

    expect(updateExpense).toHaveBeenCalledWith(1, { isPaused: true })
    await waitFor(() => expect(screen.queryByText('Groceries')).toBeNull())

    await user.click(screen.getByRole('button', { name: 'Show paused / archived / removed' }))
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0)

    vi.mocked(updateExpense).mockResolvedValue({ ...groceries, isPaused: false })
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    await user.click(screen.getAllByRole('button', { name: 'Unpause Groceries' })[0]!)

    expect(updateExpense).toHaveBeenCalledWith(1, { isPaused: false })
  })

  it('archives an expense, superseding an existing pause, and can be unarchived', async () => {
    vi.mocked(listExpenses).mockResolvedValue([{ ...groceries, isPaused: true }])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockResolvedValue({
      ...groceries,
      isPaused: false,
      isArchived: true,
    })
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Groceries')
    vi.mocked(listExpenses).mockResolvedValue([{ ...groceries, isPaused: false, isArchived: true }])
    await user.click(screen.getAllByRole('button', { name: 'Archive Groceries' })[0]!)

    expect(updateExpense).toHaveBeenCalledWith(1, { isArchived: true })
    await waitFor(() => expect(screen.getAllByText('Archived').length).toBeGreaterThan(0))
    expect(screen.queryByText('Paused')).toBeNull()

    vi.mocked(updateExpense).mockResolvedValue({ ...groceries, isArchived: false })
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    await user.click(screen.getAllByRole('button', { name: 'Unarchive Groceries' })[0]!)

    expect(updateExpense).toHaveBeenCalledWith(1, { isArchived: false })
  })

  it('restores a removed expense', async () => {
    const removed = { ...groceries, isActive: false }
    vi.mocked(listExpenses).mockResolvedValue([removed])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(ExpensesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await waitFor(() => expect(screen.getAllByText('Removed').length).toBeGreaterThan(0))
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    await user.click(screen.getAllByRole('button', { name: 'Restore Groceries' })[0]!)

    expect(updateExpense).toHaveBeenCalledWith(1, { isActive: true })
  })

  it('archives an expense from the desktop actions menu', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockResolvedValue({ ...groceries, isArchived: true })
    const user = userEvent.setup()
    render(ExpensesPage)

    await screen.findByText('Groceries')
    await user.click(await screen.findByRole('button', { name: 'Actions for Groceries' }))
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }))

    expect(updateExpense).toHaveBeenCalledWith(1, { isArchived: true })
  })

  it('drags an expense to a new position, swapping sort order', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries, rent])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockResolvedValue(groceries)
    const { container } = render(ExpensesPage)

    await screen.findByText('Groceries')
    const tbody = container.querySelector('tbody')!
    tbody.dispatchEvent(
      new CustomEvent('finalize', {
        detail: {
          items: [
            { id: 2, expense: rent, trend: noTrend },
            { id: 1, expense: groceries, trend: noTrend },
          ],
          info: { trigger: 'droppedIntoZone', id: '2', source: 'pointer' },
        },
      })
    )

    expect(updateExpense).toHaveBeenCalledWith(1, { sortOrder: 2 })
    expect(updateExpense).toHaveBeenCalledWith(2, { sortOrder: 1 })
  })

  it('shows an error when reordering fails', async () => {
    vi.mocked(listExpenses).mockResolvedValue([groceries, rent])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(updateExpense).mockRejectedValue(new ApiError(500, 'Failed to reorder'))
    const { container } = render(ExpensesPage)

    await screen.findByText('Groceries')
    const tbody = container.querySelector('tbody')!
    tbody.dispatchEvent(
      new CustomEvent('finalize', {
        detail: {
          items: [
            { id: 2, expense: rent, trend: noTrend },
            { id: 1, expense: groceries, trend: noTrend },
          ],
          info: { trigger: 'droppedIntoZone', id: '2', source: 'pointer' },
        },
      })
    )

    expect(await screen.findByText('Failed to reorder')).toBeInTheDocument()
  })
})
