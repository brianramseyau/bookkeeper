import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCategories, type Category } from '$lib/api/categories'
import {
  listCategoryActuals,
  getCategoryTrend,
  createCategoryActual,
  updateCategoryActual,
  deleteCategoryActual,
  type CategoryMonthlyActual,
  type CategoryTrend,
} from '$lib/api/category-actuals'
import {
  listCategoryBudgetItems,
  createCategoryBudgetItem,
  updateCategoryBudgetItem,
  deleteCategoryBudgetItem,
  type CategoryBudgetItem,
} from '$lib/api/category-budget-items'
import { ApiError } from '$lib/api'
import { page } from '$app/state'
import CategoryDetailPage from './+page.svelte'

vi.mock('$app/state', () => ({ page: { params: { categoryId: '1' } } }))

vi.mock('$lib/api/categories', () => ({
  listCategories: vi.fn(),
}))

vi.mock('$lib/api/category-actuals', () => ({
  listCategoryActuals: vi.fn(),
  getCategoryTrend: vi.fn(),
  createCategoryActual: vi.fn(),
  updateCategoryActual: vi.fn(),
  deleteCategoryActual: vi.fn(),
}))

vi.mock('$lib/api/category-budget-items', () => ({
  listCategoryBudgetItems: vi.fn(),
  createCategoryBudgetItem: vi.fn(),
  updateCategoryBudgetItem: vi.fn(),
  deleteCategoryBudgetItem: vi.fn(),
}))

const groceries: Category = {
  id: 1,
  name: 'Groceries',
  color: '#22c55e',
  sortOrder: 1,
  budgetAmount: 400,
  budgetItemCount: 0,
  includeInStandardMonth: true,
  isActive: true,
  isPaused: false,
  isArchived: false,
}

const groceriesNoBudget: Category = { ...groceries, budgetAmount: null }

const noTrend: CategoryTrend = {
  average: null,
  latestAmount: null,
  latestYear: null,
  latestMonth: null,
  trend: null,
  months: [],
}

const upTrend: CategoryTrend = {
  average: 350,
  latestAmount: 380,
  latestYear: 2026,
  latestMonth: 6,
  trend: 'up',
  months: [],
}

const insurance: CategoryBudgetItem = {
  id: 10,
  categoryId: 1,
  name: 'Insurance',
  amount: 50,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

const food: CategoryBudgetItem = {
  id: 11,
  categoryId: 1,
  name: 'Food',
  amount: 100,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

const januaryShop: CategoryMonthlyActual = {
  id: 20,
  categoryId: 1,
  occurredOn: '2026-01-15',
  amount: 120,
  notes: 'Weekly shop',
  createdAt: '',
  updatedAt: '',
}

const februaryShop: CategoryMonthlyActual = {
  id: 21,
  categoryId: 1,
  occurredOn: '2026-02-20',
  amount: 150,
  notes: null,
  createdAt: '',
  updatedAt: '',
}

function mockLoad(
  overrides: {
    categories?: Category[]
    actuals?: CategoryMonthlyActual[]
    trend?: CategoryTrend
    items?: CategoryBudgetItem[]
  } = {}
) {
  vi.mocked(listCategories).mockResolvedValue(overrides.categories ?? [groceries])
  vi.mocked(listCategoryActuals).mockResolvedValue(overrides.actuals ?? [])
  vi.mocked(getCategoryTrend).mockResolvedValue(overrides.trend ?? noTrend)
  vi.mocked(listCategoryBudgetItems).mockResolvedValue(overrides.items ?? [])
}

describe('category detail page', () => {
  beforeEach(() => {
    page.params = { categoryId: '1' }
    vi.mocked(listCategories).mockReset()
    vi.mocked(listCategoryActuals).mockReset()
    vi.mocked(getCategoryTrend).mockReset()
    vi.mocked(listCategoryBudgetItems).mockReset()
    vi.mocked(createCategoryActual).mockReset()
    vi.mocked(updateCategoryActual).mockReset()
    vi.mocked(deleteCategoryActual).mockReset()
    vi.mocked(createCategoryBudgetItem).mockReset()
    vi.mocked(updateCategoryBudgetItem).mockReset()
    vi.mocked(deleteCategoryBudgetItem).mockReset()
  })

  it('shows a loading state, then falls back to not-found since a failed load leaves no category', async () => {
    // The template only renders the error banner inside the "category loaded"
    // branch, so a load failure (category stays null) surfaces as the
    // not-found message rather than the API error text.
    vi.mocked(listCategories).mockRejectedValue(new ApiError(500, 'Could not load category'))
    vi.mocked(listCategoryActuals).mockResolvedValue([])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(listCategoryBudgetItems).mockResolvedValue([])
    render(CategoryDetailPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Category not found.')).toBeInTheDocument()
  })

  it('falls back to not-found for a non-API load failure too', async () => {
    vi.mocked(listCategories).mockRejectedValue(new Error('boom'))
    vi.mocked(listCategoryActuals).mockResolvedValue([])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(listCategoryBudgetItems).mockResolvedValue([])
    render(CategoryDetailPage)

    expect(await screen.findByText('Category not found.')).toBeInTheDocument()
  })

  it('shows a not-found message when the category does not exist', async () => {
    mockLoad({ categories: [{ ...groceries, id: 2 }] })
    render(CategoryDetailPage)

    expect(await screen.findByText('Category not found.')).toBeInTheDocument()
  })

  it('renders summary tiles for latest, average, budget target and trend', async () => {
    mockLoad({ trend: upTrend })
    render(CategoryDetailPage)

    expect(await screen.findByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('$380.00')).toBeInTheDocument()
    expect(screen.getByText('$350.00')).toBeInTheDocument()
    expect(screen.getByText('$400.00')).toBeInTheDocument()
    expect(screen.getByText('▲ up')).toBeInTheDocument()
  })

  it('shows a down trend indicator', async () => {
    mockLoad({ trend: { ...upTrend, trend: 'down' } })
    render(CategoryDetailPage)
    expect(await screen.findByText('▼ down')).toBeInTheDocument()
  })

  it('shows a flat trend indicator when there is no trend data', async () => {
    mockLoad()
    render(CategoryDetailPage)
    expect(await screen.findByText('— flat')).toBeInTheDocument()
  })

  it('does not render a budget target tile when the category has no budget', async () => {
    mockLoad({ categories: [groceriesNoBudget] })
    render(CategoryDetailPage)

    await screen.findByText('Groceries')
    expect(screen.queryByText('Budget target')).toBeNull()
  })

  it('shows a warning and empty state when a manually-budgeted category has no items', async () => {
    mockLoad()
    render(CategoryDetailPage)

    expect(await screen.findByText(/manually-set budget of \$400\.00/)).toBeInTheDocument()
    expect(screen.getByText('No items yet.')).toBeInTheDocument()
  })

  it('renders budget items with a total', async () => {
    mockLoad({ items: [insurance, food] })
    render(CategoryDetailPage)

    expect(await screen.findByText('Insurance')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
  })

  it('requires a name and amount to add a budget item', async () => {
    mockLoad()
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('No items yet.')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(await screen.findByText('Name and amount are required')).toBeInTheDocument()
    expect(createCategoryBudgetItem).not.toHaveBeenCalled()
  })

  it('adds a budget item and reloads the list', async () => {
    mockLoad()
    vi.mocked(createCategoryBudgetItem).mockResolvedValue(insurance)
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('No items yet.')
    vi.mocked(listCategoryBudgetItems).mockResolvedValue([insurance])

    await user.type(screen.getByLabelText('Item'), 'Insurance')
    await user.type(screen.getAllByLabelText('Amount')[0]!, '50')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(createCategoryBudgetItem).toHaveBeenCalledWith(1, { name: 'Insurance', amount: 50 })
    expect(await screen.findByText('Insurance')).toBeInTheDocument()
  })

  it('shows an error when adding a budget item fails', async () => {
    mockLoad()
    vi.mocked(createCategoryBudgetItem).mockRejectedValue(new ApiError(422, 'Item name taken'))
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('No items yet.')
    await user.type(screen.getByLabelText('Item'), 'Insurance')
    await user.type(screen.getAllByLabelText('Amount')[0]!, '50')
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    expect(await screen.findByText('Item name taken')).toBeInTheDocument()
  })

  it('edits a budget item and saves the changes', async () => {
    mockLoad({ items: [insurance] })
    vi.mocked(updateCategoryBudgetItem).mockResolvedValue({
      ...insurance,
      name: 'Home insurance',
      amount: 75,
    })
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Insurance' }))

    const nameInput = screen.getByDisplayValue('Insurance')
    await user.clear(nameInput)
    await user.type(nameInput, 'Home insurance')

    const amountInput = screen.getByDisplayValue('50')
    await user.clear(amountInput)
    await user.type(amountInput, '75')

    vi.mocked(listCategoryBudgetItems).mockResolvedValue([
      { ...insurance, name: 'Home insurance', amount: 75 },
    ])

    await user.click(screen.getByRole('button', { name: 'Save Insurance' }))

    expect(updateCategoryBudgetItem).toHaveBeenCalledWith(10, {
      name: 'Home insurance',
      amount: 75,
    })
    expect(await screen.findByText('Home insurance')).toBeInTheDocument()
  })

  it('cancels an in-progress budget item edit', async () => {
    mockLoad({ items: [insurance] })
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Insurance' }))
    const nameInput = screen.getByDisplayValue('Insurance')
    await user.clear(nameInput)
    await user.type(nameInput, 'Should not save')
    await user.click(screen.getByRole('button', { name: 'Cancel editing Insurance' }))

    expect(updateCategoryBudgetItem).not.toHaveBeenCalled()
    expect(await screen.findByText('Insurance')).toBeInTheDocument()
  })

  it('requires a name and amount when saving a budget item edit', async () => {
    mockLoad({ items: [insurance] })
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Insurance' }))
    const nameInput = screen.getByDisplayValue('Insurance')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: 'Save Insurance' }))

    expect(await screen.findByText('Name and amount are required')).toBeInTheDocument()
    expect(updateCategoryBudgetItem).not.toHaveBeenCalled()
  })

  it('shows an error when saving a budget item edit fails', async () => {
    mockLoad({ items: [insurance] })
    vi.mocked(updateCategoryBudgetItem).mockRejectedValue(new ApiError(500, 'Could not save item'))
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Insurance' }))
    await user.click(screen.getByRole('button', { name: 'Save Insurance' }))

    expect(await screen.findByText('Could not save item')).toBeInTheDocument()
  })

  it('deletes a budget item', async () => {
    mockLoad({ items: [insurance] })
    vi.mocked(deleteCategoryBudgetItem).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('Insurance')
    await user.click(screen.getByRole('button', { name: 'Delete Insurance' }))

    expect(deleteCategoryBudgetItem).toHaveBeenCalledWith(10)
    expect(await screen.findByText('No items yet.')).toBeInTheDocument()
  })

  it('shows an error when deleting a budget item fails', async () => {
    mockLoad({ items: [insurance] })
    vi.mocked(deleteCategoryBudgetItem).mockRejectedValue(
      new ApiError(500, 'Could not delete item')
    )
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Delete Insurance' }))

    expect(await screen.findByText('Could not delete item')).toBeInTheDocument()
    expect(screen.getByText('Insurance')).toBeInTheDocument()
  })

  it('shows an empty state when there are no monthly actuals', async () => {
    mockLoad()
    render(CategoryDetailPage)

    expect(await screen.findByText('No entries yet.')).toBeInTheDocument()
  })

  it('renders monthly actuals sorted with the newest first', async () => {
    mockLoad({ actuals: [januaryShop, februaryShop] })
    render(CategoryDetailPage)

    const rows = await screen.findAllByRole('row')
    const bodyRowText = rows.map((r) => r.textContent ?? '')
    const febIndex = bodyRowText.findIndex((t) => t.includes('150.00'))
    const janIndex = bodyRowText.findIndex((t) => t.includes('120.00'))
    expect(febIndex).toBeGreaterThan(-1)
    expect(janIndex).toBeGreaterThan(febIndex)
    expect(screen.getByText('Weekly shop')).toBeInTheDocument()
  })

  it('requires a date and amount to add a monthly actual', async () => {
    mockLoad()
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('No entries yet.')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(await screen.findByText('Date and amount are required')).toBeInTheDocument()
    expect(createCategoryActual).not.toHaveBeenCalled()
  })

  it('adds a monthly actual and reloads the page', async () => {
    mockLoad()
    vi.mocked(createCategoryActual).mockResolvedValue(januaryShop)
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('No entries yet.')

    await user.type(screen.getByLabelText('Date'), '2026-01-15')
    await user.type(screen.getAllByLabelText('Amount')[1]!, '120')
    await user.type(screen.getByLabelText('Notes'), 'Weekly shop')

    mockLoad({ actuals: [januaryShop] })

    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(createCategoryActual).toHaveBeenCalledWith(1, {
      occurredOn: '2026-01-15',
      amount: 120,
      notes: 'Weekly shop',
    })
    expect(await screen.findByText('Weekly shop')).toBeInTheDocument()
  })

  it('omits notes when adding a monthly actual without any', async () => {
    mockLoad()
    vi.mocked(createCategoryActual).mockResolvedValue({ ...januaryShop, notes: null })
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('No entries yet.')
    await user.type(screen.getByLabelText('Date'), '2026-01-15')
    await user.type(screen.getAllByLabelText('Amount')[1]!, '120')

    mockLoad({ actuals: [{ ...januaryShop, notes: null }] })
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(createCategoryActual).toHaveBeenCalledWith(1, {
      occurredOn: '2026-01-15',
      amount: 120,
      notes: undefined,
    })
  })

  it('shows an error when adding a monthly actual fails', async () => {
    mockLoad()
    vi.mocked(createCategoryActual).mockRejectedValue(new ApiError(500, 'Could not add entry'))
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('No entries yet.')
    await user.type(screen.getByLabelText('Date'), '2026-01-15')
    await user.type(screen.getAllByLabelText('Amount')[1]!, '120')
    await user.click(screen.getByRole('button', { name: 'Add entry' }))

    expect(await screen.findByText('Could not add entry')).toBeInTheDocument()
  })

  it('edits a monthly actual and saves the changes', async () => {
    mockLoad({ actuals: [januaryShop] })
    vi.mocked(updateCategoryActual).mockResolvedValue({ ...januaryShop, amount: 200 })
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 15 Jan 2026' }))

    const amountInput = screen.getByDisplayValue('120')
    await user.clear(amountInput)
    await user.type(amountInput, '200')

    mockLoad({ actuals: [{ ...januaryShop, amount: 200 }] })

    await user.click(screen.getByRole('button', { name: 'Save entry from 15 Jan 2026' }))

    expect(updateCategoryActual).toHaveBeenCalledWith(20, {
      occurredOn: '2026-01-15',
      amount: 200,
      notes: 'Weekly shop',
    })
    expect(await screen.findByText('$200.00')).toBeInTheDocument()
  })

  it('sends null notes when saving a monthly actual edit with notes cleared', async () => {
    mockLoad({ actuals: [januaryShop] })
    vi.mocked(updateCategoryActual).mockResolvedValue({ ...januaryShop, notes: null })
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 15 Jan 2026' }))
    const notesInput = screen.getByDisplayValue('Weekly shop')
    await user.clear(notesInput)

    mockLoad({ actuals: [{ ...januaryShop, notes: null }] })
    await user.click(screen.getByRole('button', { name: 'Save entry from 15 Jan 2026' }))

    expect(updateCategoryActual).toHaveBeenCalledWith(20, {
      occurredOn: '2026-01-15',
      amount: 120,
      notes: null,
    })
  })

  it('cancels an in-progress monthly actual edit', async () => {
    mockLoad({ actuals: [januaryShop] })
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 15 Jan 2026' }))
    const amountInput = screen.getByDisplayValue('120')
    await user.clear(amountInput)
    await user.type(amountInput, '999')
    await user.click(screen.getByRole('button', { name: 'Cancel editing entry from 15 Jan 2026' }))

    expect(updateCategoryActual).not.toHaveBeenCalled()
    expect(await screen.findByText('$120.00')).toBeInTheDocument()
  })

  it('requires a date and amount when saving a monthly actual edit', async () => {
    mockLoad({ actuals: [januaryShop] })
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 15 Jan 2026' }))
    const dateInput = screen.getByDisplayValue('2026-01-15')
    await user.clear(dateInput)
    await user.click(screen.getByRole('button', { name: 'Save entry from 15 Jan 2026' }))

    expect(await screen.findByText('Date and amount are required')).toBeInTheDocument()
    expect(updateCategoryActual).not.toHaveBeenCalled()
  })

  it('shows an error when saving a monthly actual edit fails', async () => {
    mockLoad({ actuals: [januaryShop] })
    vi.mocked(updateCategoryActual).mockRejectedValue(new ApiError(500, 'Could not save entry'))
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 15 Jan 2026' }))
    await user.click(screen.getByRole('button', { name: 'Save entry from 15 Jan 2026' }))

    expect(await screen.findByText('Could not save entry')).toBeInTheDocument()
  })

  it('deletes a monthly actual and refreshes the trend', async () => {
    mockLoad({ actuals: [januaryShop], trend: upTrend })
    vi.mocked(deleteCategoryActual).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await screen.findByText('Weekly shop')
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)

    await user.click(screen.getByRole('button', { name: 'Delete entry from 15 Jan 2026' }))

    expect(deleteCategoryActual).toHaveBeenCalledWith(20)
    expect(await screen.findByText('No entries yet.')).toBeInTheDocument()
    expect(await screen.findByText('— flat')).toBeInTheDocument()
  })

  it('shows an error when deleting a monthly actual fails', async () => {
    mockLoad({ actuals: [januaryShop] })
    vi.mocked(deleteCategoryActual).mockRejectedValue(new ApiError(500, 'Could not delete entry'))
    const user = userEvent.setup()
    render(CategoryDetailPage)

    await user.click(await screen.findByRole('button', { name: 'Delete entry from 15 Jan 2026' }))

    expect(await screen.findByText('Could not delete entry')).toBeInTheDocument()
    expect(screen.getByText('Weekly shop')).toBeInTheDocument()
  })
})
