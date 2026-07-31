import { render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from '$lib/api/categories'
import { getCategoryTrend, type CategoryTrend } from '$lib/api/category-actuals'
import { ApiError } from '$lib/api'
import CategoriesPage from './+page.svelte'

vi.mock('$lib/api/categories', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

vi.mock('$lib/api/category-actuals', () => ({
  getCategoryTrend: vi.fn(),
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

const rent: Category = {
  id: 2,
  name: 'Rent',
  color: null,
  sortOrder: 2,
  budgetAmount: 2000,
  budgetItemCount: 3,
  includeInStandardMonth: false,
  isActive: true,
  isPaused: false,
  isArchived: false,
}

const noTrend: CategoryTrend = {
  average: null,
  latestAmount: null,
  latestYear: null,
  latestMonth: null,
  trend: null,
  months: [],
}

describe('categories page', () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockReset()
    vi.mocked(createCategory).mockReset()
    vi.mocked(updateCategory).mockReset()
    vi.mocked(deleteCategory).mockReset()
    vi.mocked(getCategoryTrend).mockReset()
  })

  it('shows a loading state, then an error on failure', async () => {
    vi.mocked(listCategories).mockRejectedValue(new ApiError(500, 'Could not load categories'))
    render(CategoriesPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('Could not load categories')).toBeInTheDocument()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(listCategories).mockRejectedValue(new Error('boom'))
    render(CategoriesPage)
    expect(await screen.findByText('Failed to load categories')).toBeInTheDocument()
  })

  it('shows an empty table when there are no categories', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    render(CategoriesPage)

    await screen.findByPlaceholderText('Add a category (e.g. Entertainment)')
    expect(screen.queryByText('Groceries')).toBeNull()
  })

  it('renders categories with budget, trend and standard-month indicators', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    vi.mocked(getCategoryTrend).mockImplementation((id) =>
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
    render(CategoriesPage)

    const link = await screen.findByRole('link', { name: /Groceries/ })
    expect(link.getAttribute('href')).toBe('/categories/1')
    expect(screen.getByText('▲ up')).toBeInTheDocument()
    expect(screen.getByText('$380.00')).toBeInTheDocument()
    expect(screen.getByText('$350.00')).toBeInTheDocument()

    // Rent is itemized, so its budget shows a derived-value marker.
    expect(screen.getByTitle('Excluded from Monthly')).toBeInTheDocument()
    expect(screen.getByTitle('Included in Monthly')).toBeInTheDocument()
    expect(screen.getByTitle('Derived from 3 itemized budget line(s)')).toBeInTheDocument()
  })

  it('shows a flat trend indicator', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(getCategoryTrend).mockResolvedValue({
      average: 100,
      latestAmount: 100,
      latestYear: 2026,
      latestMonth: 6,
      trend: 'flat',
      months: [],
    })
    render(CategoriesPage)

    expect(await screen.findByText('— flat')).toBeInTheDocument()
  })

  it('shows a down trend indicator', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(getCategoryTrend).mockResolvedValue({
      average: 100,
      latestAmount: 80,
      latestYear: 2026,
      latestMonth: 6,
      trend: 'down',
      months: [],
    })
    render(CategoriesPage)

    expect(await screen.findByText('▼ down')).toBeInTheDocument()
  })

  it('adds a new category and reloads the list', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(createCategory).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByPlaceholderText('Add a category (e.g. Entertainment)')
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)

    await user.type(screen.getByPlaceholderText('Add a category (e.g. Entertainment)'), 'Groceries')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(createCategory).toHaveBeenCalledWith({ name: 'Groceries' })
    expect(await screen.findByText('Groceries')).toBeInTheDocument()
  })

  it('does not submit an empty or whitespace-only category name', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByPlaceholderText('Add a category (e.g. Entertainment)')
    await user.type(screen.getByPlaceholderText('Add a category (e.g. Entertainment)'), '   ')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(createCategory).not.toHaveBeenCalled()
  })

  it('shows an error when adding a category fails', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(createCategory).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.type(
      await screen.findByPlaceholderText('Add a category (e.g. Entertainment)'),
      'Groceries'
    )
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(await screen.findByText('Name already exists')).toBeInTheDocument()
  })

  it('edits a non-itemized category, including its budget amount', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, name: 'Food' })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))

    const nameInput = screen.getByDisplayValue('Groceries')
    await user.clear(nameInput)
    await user.type(nameInput, 'Food')

    const budgetInput = screen.getByPlaceholderText('—') as HTMLInputElement
    await user.clear(budgetInput)
    await user.type(budgetInput, '450')

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    await user.click(checkbox)

    vi.mocked(listCategories).mockResolvedValue([{ ...groceries, name: 'Food' }])

    await user.click(screen.getByRole('button', { name: 'Save Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, {
      name: 'Food',
      color: '#22c55e',
      budgetAmount: 450,
      includeInStandardMonth: false,
    })
    expect(await screen.findByText('Food')).toBeInTheDocument()
  })

  it('does not send budgetAmount when editing an itemized category', async () => {
    vi.mocked(listCategories).mockResolvedValue([rent])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(updateCategory).mockResolvedValue(rent)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Rent' }))
    await user.click(screen.getByRole('button', { name: 'Save Rent' }))

    expect(updateCategory).toHaveBeenCalledWith(2, {
      name: 'Rent',
      color: '#64748b',
      includeInStandardMonth: false,
    })
  })

  it('cancels an in-progress edit without saving', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const nameInput = screen.getByDisplayValue('Groceries')
    await user.clear(nameInput)
    await user.type(nameInput, 'Should not save')
    await user.click(screen.getByRole('button', { name: 'Cancel editing Groceries' }))

    expect(updateCategory).not.toHaveBeenCalled()
    expect(await screen.findByText('Groceries')).toBeInTheDocument()
  })

  it('requires a name when saving an edit', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const nameInput = screen.getByDisplayValue('Groceries')
    await user.clear(nameInput)
    await user.click(screen.getByRole('button', { name: 'Save Groceries' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(updateCategory).not.toHaveBeenCalled()
  })

  it('shows an error when saving an edit fails', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(updateCategory).mockRejectedValue(new ApiError(500, 'Could not save changes'))
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    await user.click(screen.getByRole('button', { name: 'Save Groceries' }))

    expect(await screen.findByText('Could not save changes')).toBeInTheDocument()
  })

  it('does not offer Remove on an active or paused category, only once archived', async () => {
    vi.mocked(listCategories).mockResolvedValue([{ ...groceries, isPaused: true }])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Groceries')
    expect(screen.queryByRole('button', { name: 'Delete Groceries' })).toBeNull()
  })

  it('permanently removes an archived category after confirming', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listCategories).mockResolvedValue([archived, rent])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(deleteCategory).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Groceries')
    vi.mocked(listCategories).mockResolvedValue([rent])
    await user.click(screen.getByRole('button', { name: 'Delete Groceries' }))

    expect(window.confirm).toHaveBeenCalledWith(
      'Permanently delete "Groceries"? This cannot be undone.'
    )
    expect(deleteCategory).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.queryByText('Groceries')).toBeNull())
  })

  it('does not remove an archived category when the confirmation is declined', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listCategories).mockResolvedValue([archived])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await user.click(await screen.findByRole('button', { name: 'Delete Groceries' }))

    expect(deleteCategory).not.toHaveBeenCalled()
  })

  it('shows an error when permanently removing fails', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listCategories).mockResolvedValue([archived])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(deleteCategory).mockRejectedValue(new ApiError(500, 'Failed to remove'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await user.click(await screen.findByRole('button', { name: 'Delete Groceries' }))

    expect(await screen.findByText('Failed to remove')).toBeInTheDocument()
  })

  it('pauses a category and reveals it under "Show paused / archived / removed"', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, isPaused: true })
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByText('Groceries')
    vi.mocked(listCategories).mockResolvedValue([{ ...groceries, isPaused: true }])
    await user.click(screen.getByRole('button', { name: 'Pause Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, { isPaused: true })
    await waitFor(() => expect(screen.queryByText('Groceries')).toBeNull())

    await user.click(screen.getByRole('button', { name: 'Show paused / archived / removed' }))
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0)
  })

  it('archives a category, superseding an existing pause, and can be unarchived', async () => {
    vi.mocked(listCategories).mockResolvedValue([{ ...groceries, isPaused: true }])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(updateCategory).mockResolvedValue({
      ...groceries,
      isPaused: false,
      isArchived: true,
    })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await screen.findByText('Groceries')
    vi.mocked(listCategories).mockResolvedValue([
      { ...groceries, isPaused: false, isArchived: true },
    ])
    await user.click(screen.getByRole('button', { name: 'Archive Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, { isArchived: true })
    await waitFor(() => expect(screen.getAllByText('Archived').length).toBeGreaterThan(0))
    expect(screen.queryByText('Paused')).toBeNull()

    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, isArchived: false })
    vi.mocked(listCategories).mockResolvedValue([groceries])
    await user.click(screen.getByRole('button', { name: 'Unarchive Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, { isArchived: false })
  })

  it('restores a removed category', async () => {
    const removed = { ...groceries, isActive: false }
    vi.mocked(listCategories).mockResolvedValue([removed])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(updateCategory).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(
      await screen.findByRole('button', { name: 'Show paused / archived / removed' })
    )
    await waitFor(() => expect(screen.getAllByText('Removed').length).toBeGreaterThan(0))
    vi.mocked(listCategories).mockResolvedValue([groceries])
    await user.click(screen.getByRole('button', { name: 'Restore Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, { isActive: true })
  })

  it('moves a category down and up, swapping sort order', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(updateCategory).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByText('Groceries')
    const upButtons = screen.getAllByRole('button', { name: /Move .* up/ })
    const downButtons = screen.getAllByRole('button', { name: /Move .* down/ })

    expect(upButtons[0]).toBeDisabled()
    expect(downButtons[1]).toBeDisabled()

    await user.click(downButtons[0]!)

    expect(updateCategory).toHaveBeenCalledWith(1, { sortOrder: 2 })
    expect(updateCategory).toHaveBeenCalledWith(2, { sortOrder: 1 })
  })

  it('shows an error when reordering fails', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    vi.mocked(getCategoryTrend).mockResolvedValue(noTrend)
    vi.mocked(updateCategory).mockRejectedValue(new ApiError(500, 'Failed to reorder'))
    const user = userEvent.setup()
    render(CategoriesPage)

    const downButtons = await screen.findAllByRole('button', { name: /Move .* down/ })
    await user.click(downButtons[0]!)

    expect(await screen.findByText('Failed to reorder')).toBeInTheDocument()
  })
})
