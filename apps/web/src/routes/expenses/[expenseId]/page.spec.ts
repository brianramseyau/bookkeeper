import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listExpenses, updateExpense, type Expense } from '$lib/api/expenses'
import {
  listExpenseActuals,
  getExpenseTrend,
  createExpenseActual,
  updateExpenseActual,
  deleteExpenseActual,
  type ExpenseMonthlyActual,
  type ExpenseTrend,
} from '$lib/api/expense-actuals'
import {
  listExpenseBudgetItems,
  createExpenseBudgetItem,
  updateExpenseBudgetItem,
  deleteExpenseBudgetItem,
  type ExpenseBudgetItem,
} from '$lib/api/expense-budget-items'
import { listCategories, type Category } from '$lib/api/categories'
import { ApiError } from '$lib/api'
import { page } from '$app/state'
import ExpenseDetailPage from './+page.svelte'

vi.mock('$app/state', () => ({ page: { params: { expenseId: '1' } } }))

vi.mock('$lib/api/expenses', () => ({
  listExpenses: vi.fn(),
  updateExpense: vi.fn(),
}))

vi.mock('$lib/api/expense-actuals', () => ({
  listExpenseActuals: vi.fn(),
  getExpenseTrend: vi.fn(),
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

const groceriesNoBudget: Expense = { ...groceries, budgetAmount: null }

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

const upTrend: ExpenseTrend = {
  average: 350,
  latestAmount: 380,
  latestYear: 2026,
  latestMonth: 6,
  trend: 'up',
  months: [],
}

const insurance: ExpenseBudgetItem = {
  id: 10,
  expenseId: 1,
  name: 'Insurance',
  amount: 50,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

const food: ExpenseBudgetItem = {
  id: 11,
  expenseId: 1,
  name: 'Food',
  amount: 100,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

const januaryShop: ExpenseMonthlyActual = {
  id: 20,
  expenseId: 1,
  occurredOn: '2026-01-15',
  amount: 120,
  notes: 'Weekly shop',
  createdAt: '',
  updatedAt: '',
}

const februaryShop: ExpenseMonthlyActual = {
  id: 21,
  expenseId: 1,
  occurredOn: '2026-02-20',
  amount: 150,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

function mockLoad(
  overrides: {
    expenses?: Expense[]
    categories?: Category[]
    actuals?: ExpenseMonthlyActual[]
    trend?: ExpenseTrend
    items?: ExpenseBudgetItem[]
  } = {}
) {
  vi.mocked(listExpenses).mockResolvedValue(overrides.expenses ?? [groceries])
  vi.mocked(listCategories).mockResolvedValue(overrides.categories ?? [])
  vi.mocked(listExpenseActuals).mockResolvedValue(overrides.actuals ?? [])
  vi.mocked(getExpenseTrend).mockResolvedValue(overrides.trend ?? noTrend)
  vi.mocked(listExpenseBudgetItems).mockResolvedValue(overrides.items ?? [])
}

describe('expense detail page', () => {
  beforeEach(() => {
    page.params = { expenseId: '1' }
    vi.mocked(listExpenses).mockReset()
    vi.mocked(updateExpense).mockReset()
    vi.mocked(listCategories).mockReset()
    vi.mocked(listExpenseActuals).mockReset()
    vi.mocked(getExpenseTrend).mockReset()
    vi.mocked(listExpenseBudgetItems).mockReset()
    vi.mocked(createExpenseActual).mockReset()
    vi.mocked(updateExpenseActual).mockReset()
    vi.mocked(deleteExpenseActual).mockReset()
    vi.mocked(createExpenseBudgetItem).mockReset()
    vi.mocked(updateExpenseBudgetItem).mockReset()
    vi.mocked(deleteExpenseBudgetItem).mockReset()
  })

  it('shows a loading state, then falls back to not-found since a failed load leaves no expense', async () => {
    // The template only renders the error banner inside the "expense loaded"
    // branch, so a load failure (expense stays null) surfaces as the
    // not-found message rather than the API error text.
    vi.mocked(listExpenses).mockRejectedValue(new ApiError(500, 'Could not load expense'))
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(listExpenseActuals).mockResolvedValue([])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(listExpenseBudgetItems).mockResolvedValue([])
    render(ExpenseDetailPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Expense not found.')).toBeInTheDocument()
  })

  it('falls back to not-found for a non-API load failure too', async () => {
    vi.mocked(listExpenses).mockRejectedValue(new Error('boom'))
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(listExpenseActuals).mockResolvedValue([])
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)
    vi.mocked(listExpenseBudgetItems).mockResolvedValue([])
    render(ExpenseDetailPage)

    expect(await screen.findByText('Expense not found.')).toBeInTheDocument()
  })

  it('shows a not-found message when the expense does not exist', async () => {
    mockLoad({ expenses: [{ ...groceries, id: 2 }] })
    render(ExpenseDetailPage)

    expect(await screen.findByText('Expense not found.')).toBeInTheDocument()
  })

  it('renders summary tiles for latest, average, budget target and trend', async () => {
    mockLoad({ trend: upTrend })
    render(ExpenseDetailPage)

    expect(await screen.findByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('$380.00')).toBeInTheDocument()
    expect(screen.getByText('$350.00')).toBeInTheDocument()
    expect(screen.getByText('$400.00')).toBeInTheDocument()
    expect(screen.getByText('▲ up')).toBeInTheDocument()
  })

  it('shows a down trend indicator', async () => {
    mockLoad({ trend: { ...upTrend, trend: 'down' } })
    render(ExpenseDetailPage)
    expect(await screen.findByText('▼ down')).toBeInTheDocument()
  })

  it('shows a flat trend indicator when there is no trend data', async () => {
    mockLoad()
    render(ExpenseDetailPage)
    expect(await screen.findByText('— flat')).toBeInTheDocument()
  })

  it('does not render a budget target tile when the expense has no budget', async () => {
    mockLoad({ expenses: [groceriesNoBudget] })
    render(ExpenseDetailPage)

    await screen.findByText('Groceries')
    expect(screen.queryByText('Budget target')).toBeNull()
  })

  it('renders a category tag select and calls updateExpense with the chosen categoryId', async () => {
    mockLoad({ categories: [foodCategory] })
    vi.mocked(updateExpense).mockResolvedValue({ ...groceries, categoryId: 10 })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    const select = await screen.findByRole('combobox')
    await user.selectOptions(select, '10')

    expect(updateExpense).toHaveBeenCalledWith(1, { categoryId: 10 })
  })

  it('shows a warning and empty state when a manually-budgeted expense has no items', async () => {
    mockLoad()
    render(ExpenseDetailPage)

    expect(await screen.findByText(/manually-set budget of \$400\.00/)).toBeInTheDocument()
    expect(screen.getByText('No items yet.')).toBeInTheDocument()
  })

  it('renders budget items with a total', async () => {
    mockLoad({ items: [insurance, food] })
    render(ExpenseDetailPage)

    expect(await screen.findByText('Insurance')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
  })

  it('requires a name and amount to add a budget item', async () => {
    mockLoad()
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('No items yet.')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(await screen.findByText('Name and amount are required')).toBeInTheDocument()
    expect(createExpenseBudgetItem).not.toHaveBeenCalled()
  })

  it('adds a budget item and reloads the list', async () => {
    mockLoad()
    vi.mocked(createExpenseBudgetItem).mockResolvedValue(insurance)
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('No items yet.')
    vi.mocked(listExpenseBudgetItems).mockResolvedValue([insurance])

    await user.type(screen.getByLabelText('Item'), 'Insurance')
    await user.type(screen.getAllByLabelText('Amount')[0]!, '50')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(createExpenseBudgetItem).toHaveBeenCalledWith(1, { name: 'Insurance', amount: 50 })
    expect(await screen.findByText('Insurance')).toBeInTheDocument()
  })

  it('shows an error when adding a budget item fails', async () => {
    mockLoad()
    vi.mocked(createExpenseBudgetItem).mockRejectedValue(new ApiError(422, 'Item name taken'))
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('No items yet.')
    await user.type(screen.getByLabelText('Item'), 'Insurance')
    await user.type(screen.getAllByLabelText('Amount')[0]!, '50')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(await screen.findByText('Item name taken')).toBeInTheDocument()
  })

  it('edits a budget item and saves the changes', async () => {
    mockLoad({ items: [insurance] })
    vi.mocked(updateExpenseBudgetItem).mockResolvedValue({
      ...insurance,
      name: 'Home insurance',
      amount: 75,
    })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Insurance' }))

    const nameInput = screen.getByDisplayValue('Insurance')
    await user.clear(nameInput)
    await user.type(nameInput, 'Home insurance')

    const amountInput = screen.getByDisplayValue('50')
    await user.clear(amountInput)
    await user.type(amountInput, '75')

    vi.mocked(listExpenseBudgetItems).mockResolvedValue([
      { ...insurance, name: 'Home insurance', amount: 75 },
    ])

    await user.click(screen.getByRole('button', { name: 'Save Insurance' }))

    expect(updateExpenseBudgetItem).toHaveBeenCalledWith(10, {
      name: 'Home insurance',
      amount: 75,
    })
    expect(await screen.findByText('Home insurance')).toBeInTheDocument()
  })

  it('cancels an in-progress budget item edit', async () => {
    mockLoad({ items: [insurance] })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Insurance' }))
    const nameInput = screen.getByDisplayValue('Insurance')
    await user.clear(nameInput)
    await user.type(nameInput, 'Should not save')
    await user.click(screen.getByRole('button', { name: 'Cancel editing Insurance' }))

    expect(updateExpenseBudgetItem).not.toHaveBeenCalled()
    expect(await screen.findByText('Insurance')).toBeInTheDocument()
  })

  it('requires a name and amount when saving a budget item edit', async () => {
    mockLoad({ items: [insurance] })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Insurance' }))
    const nameInput = screen.getByDisplayValue('Insurance')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: 'Save Insurance' }))

    expect(await screen.findByText('Name and amount are required')).toBeInTheDocument()
    expect(updateExpenseBudgetItem).not.toHaveBeenCalled()
  })

  it('shows an error when saving a budget item edit fails', async () => {
    mockLoad({ items: [insurance] })
    vi.mocked(updateExpenseBudgetItem).mockRejectedValue(new ApiError(500, 'Could not save item'))
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Insurance' }))
    await user.click(screen.getByRole('button', { name: 'Save Insurance' }))

    expect(await screen.findByText('Could not save item')).toBeInTheDocument()
  })

  it('deletes a budget item', async () => {
    mockLoad({ items: [insurance] })
    vi.mocked(deleteExpenseBudgetItem).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('Insurance')
    await user.click(screen.getByRole('button', { name: 'Delete Insurance' }))

    expect(deleteExpenseBudgetItem).toHaveBeenCalledWith(10)
    expect(await screen.findByText('No items yet.')).toBeInTheDocument()
  })

  it('shows an error when deleting a budget item fails', async () => {
    mockLoad({ items: [insurance] })
    vi.mocked(deleteExpenseBudgetItem).mockRejectedValue(new ApiError(500, 'Could not delete item'))
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Delete Insurance' }))

    expect(await screen.findByText('Could not delete item')).toBeInTheDocument()
    expect(screen.getByText('Insurance')).toBeInTheDocument()
  })

  it('shows an empty state when there are no monthly actuals', async () => {
    mockLoad()
    render(ExpenseDetailPage)

    expect(await screen.findByText('No entries yet.')).toBeInTheDocument()
  })

  it('renders monthly actuals sorted with the newest first', async () => {
    mockLoad({ actuals: [januaryShop, februaryShop] })
    render(ExpenseDetailPage)

    const rows = await screen.findAllByRole('row')
    const bodyRowText = rows.map((r) => r.textContent ?? '')
    const febIndex = bodyRowText.findIndex((t) => t.includes('150.00'))
    const janIndex = bodyRowText.findIndex((t) => t.includes('120.00'))
    expect(febIndex).toBeGreaterThan(-1)
    expect(janIndex).toBeGreaterThan(febIndex)
    expect(screen.getByText('Weekly shop')).toBeInTheDocument()
    expect(screen.getByText('Jan 2026')).toBeInTheDocument()
    expect(screen.getByText('Feb 2026')).toBeInTheDocument()
  })

  it('requires a month and amount to add a monthly actual', async () => {
    mockLoad()
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('No entries yet.')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(await screen.findByText('Month and amount are required')).toBeInTheDocument()
    expect(createExpenseActual).not.toHaveBeenCalled()
  })

  it('adds a monthly actual and reloads the page', async () => {
    mockLoad()
    vi.mocked(createExpenseActual).mockResolvedValue(januaryShop)
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('No entries yet.')

    await user.click(screen.getByLabelText('Month'))
    await user.click(screen.getByRole('button', { name: 'Jan' }))
    await user.type(screen.getAllByLabelText('Amount')[1]!, '120')
    await user.type(screen.getByLabelText('Notes'), 'Weekly shop')

    mockLoad({ actuals: [januaryShop] })

    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    const currentYear = new Date().getFullYear()
    expect(createExpenseActual).toHaveBeenCalledWith(1, {
      occurredOn: `${currentYear}-01-31`,
      amount: 120,
      notes: 'Weekly shop',
    })
    expect(await screen.findByText('Weekly shop')).toBeInTheDocument()
  })

  it('omits notes when adding a monthly actual without any', async () => {
    mockLoad()
    vi.mocked(createExpenseActual).mockResolvedValue({ ...januaryShop, notes: null })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('No entries yet.')
    await user.click(screen.getByLabelText('Month'))
    await user.click(screen.getByRole('button', { name: 'Jan' }))
    await user.type(screen.getAllByLabelText('Amount')[1]!, '120')

    mockLoad({ actuals: [{ ...januaryShop, notes: null }] })
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    const currentYear = new Date().getFullYear()
    expect(createExpenseActual).toHaveBeenCalledWith(1, {
      occurredOn: `${currentYear}-01-31`,
      amount: 120,
      notes: undefined,
    })
  })

  it('shows an error when adding a monthly actual fails', async () => {
    mockLoad()
    vi.mocked(createExpenseActual).mockRejectedValue(new ApiError(500, 'Could not add entry'))
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('No entries yet.')
    await user.click(screen.getByLabelText('Month'))
    await user.click(screen.getByRole('button', { name: 'Jan' }))
    await user.type(screen.getAllByLabelText('Amount')[1]!, '120')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(await screen.findByText('Could not add entry')).toBeInTheDocument()
  })

  it('edits a monthly actual and saves the changes', async () => {
    mockLoad({ actuals: [januaryShop] })
    vi.mocked(updateExpenseActual).mockResolvedValue({ ...januaryShop, amount: 200 })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from Jan 2026' }))

    const amountInput = screen.getByDisplayValue('120')
    await user.clear(amountInput)
    await user.type(amountInput, '200')

    mockLoad({ actuals: [{ ...januaryShop, amount: 200 }] })

    await user.click(screen.getByRole('button', { name: 'Save entry from Jan 2026' }))

    expect(updateExpenseActual).toHaveBeenCalledWith(20, {
      occurredOn: '2026-01-31',
      amount: 200,
      notes: 'Weekly shop',
    })
    expect(await screen.findByText('$200.00')).toBeInTheDocument()
  })

  it('sends null notes when saving a monthly actual edit with notes cleared', async () => {
    mockLoad({ actuals: [januaryShop] })
    vi.mocked(updateExpenseActual).mockResolvedValue({ ...januaryShop, notes: null })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from Jan 2026' }))
    const notesInput = screen.getByDisplayValue('Weekly shop')
    await user.clear(notesInput)

    mockLoad({ actuals: [{ ...januaryShop, notes: null }] })
    await user.click(screen.getByRole('button', { name: 'Save entry from Jan 2026' }))

    expect(updateExpenseActual).toHaveBeenCalledWith(20, {
      occurredOn: '2026-01-31',
      amount: 120,
      notes: null,
    })
  })

  it('cancels an in-progress monthly actual edit', async () => {
    mockLoad({ actuals: [januaryShop] })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from Jan 2026' }))
    const amountInput = screen.getByDisplayValue('120')
    await user.clear(amountInput)
    await user.type(amountInput, '999')
    await user.click(screen.getByRole('button', { name: 'Cancel editing entry from Jan 2026' }))

    expect(updateExpenseActual).not.toHaveBeenCalled()
    expect(await screen.findByText('$120.00')).toBeInTheDocument()
  })

  it('requires a month and amount when saving a monthly actual edit', async () => {
    mockLoad({ actuals: [januaryShop] })
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from Jan 2026' }))
    // Re-clicking the already-selected month clears the field.
    await user.click(screen.getByRole('button', { name: 'Jan 2026' }))
    await user.click(screen.getByRole('button', { name: 'Jan' }))
    await user.click(screen.getByRole('button', { name: 'Save entry from Jan 2026' }))

    expect(await screen.findByText('Month and amount are required')).toBeInTheDocument()
    expect(updateExpenseActual).not.toHaveBeenCalled()
  })

  it('shows an error when saving a monthly actual edit fails', async () => {
    mockLoad({ actuals: [januaryShop] })
    vi.mocked(updateExpenseActual).mockRejectedValue(new ApiError(500, 'Could not save entry'))
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from Jan 2026' }))
    await user.click(screen.getByRole('button', { name: 'Save entry from Jan 2026' }))

    expect(await screen.findByText('Could not save entry')).toBeInTheDocument()
  })

  it('deletes a monthly actual and refreshes the trend', async () => {
    mockLoad({ actuals: [januaryShop], trend: upTrend })
    vi.mocked(deleteExpenseActual).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await screen.findByText('Weekly shop')
    vi.mocked(getExpenseTrend).mockResolvedValue(noTrend)

    await user.click(screen.getByRole('button', { name: 'Delete entry from Jan 2026' }))

    expect(deleteExpenseActual).toHaveBeenCalledWith(20)
    expect(await screen.findByText('No entries yet.')).toBeInTheDocument()
    expect(await screen.findByText('— flat')).toBeInTheDocument()
  })

  it('shows an error when deleting a monthly actual fails', async () => {
    mockLoad({ actuals: [januaryShop] })
    vi.mocked(deleteExpenseActual).mockRejectedValue(new ApiError(500, 'Could not delete entry'))
    const user = userEvent.setup()
    render(ExpenseDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Delete entry from Jan 2026' }))

    expect(await screen.findByText('Could not delete entry')).toBeInTheDocument()
    expect(screen.getByText('Weekly shop')).toBeInTheDocument()
  })
})
