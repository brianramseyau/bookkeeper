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
import { ApiError } from '$lib/api'
import CategoriesPage from './+page.svelte'

vi.mock('$lib/api/categories', () => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

const groceries: Category = {
  id: 1,
  name: 'Groceries',
  color: '#22c55e',
  sortOrder: 1,
  isActive: true,
  isArchived: false,
  isSystem: false,
}

const rent: Category = {
  id: 2,
  name: 'Rent',
  color: null,
  sortOrder: 2,
  isActive: true,
  isArchived: false,
  isSystem: false,
}

const utilities: Category = {
  id: 3,
  name: 'Utilities',
  color: '#0066b2',
  sortOrder: 0,
  isActive: true,
  isArchived: false,
  isSystem: true,
}

describe('categories page', () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockReset()
    vi.mocked(createCategory).mockReset()
    vi.mocked(updateCategory).mockReset()
    vi.mocked(deleteCategory).mockReset()
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

    await screen.findByPlaceholderText('Add a category (e.g. Household)')
    expect(screen.queryByText('Groceries')).toBeNull()
  })

  it('renders active categories', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    render(CategoriesPage)

    expect(await screen.findByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Rent')).toBeInTheDocument()
  })

  it('shows a System badge for the system category and no Archive button for it', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, utilities])
    render(CategoriesPage)

    await screen.findByText('Utilities')
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive Utilities' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Archive Groceries' })).toBeInTheDocument()
  })

  it('adds a new category and reloads the list', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(createCategory).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByPlaceholderText('Add a category (e.g. Household)')
    vi.mocked(listCategories).mockResolvedValue([groceries])

    await user.type(screen.getByPlaceholderText('Add a category (e.g. Household)'), 'Groceries')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(createCategory).toHaveBeenCalledWith({ name: 'Groceries' })
    expect(await screen.findByText('Groceries')).toBeInTheDocument()
  })

  it('does not submit an empty or whitespace-only category name', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByPlaceholderText('Add a category (e.g. Household)')
    await user.type(screen.getByPlaceholderText('Add a category (e.g. Household)'), '   ')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(createCategory).not.toHaveBeenCalled()
  })

  it('shows an error when adding a category fails', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(createCategory).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.type(
      await screen.findByPlaceholderText('Add a category (e.g. Household)'),
      'Groceries'
    )
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(await screen.findByText('Name already exists')).toBeInTheDocument()
  })

  it('edits a category, saving its name and color', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, name: 'Food' })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))

    const nameInput = screen.getByDisplayValue('Groceries')
    await user.clear(nameInput)
    await user.type(nameInput, 'Food')

    vi.mocked(listCategories).mockResolvedValue([{ ...groceries, name: 'Food' }])

    await user.click(screen.getByRole('button', { name: 'Save Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, {
      name: 'Food',
      color: '#22c55e',
    })
    expect(await screen.findByText('Food')).toBeInTheDocument()
  })

  it('does not render a rename input for the system category, only saving its color', async () => {
    vi.mocked(listCategories).mockResolvedValue([utilities])
    vi.mocked(updateCategory).mockResolvedValue(utilities)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Utilities' }))

    expect(screen.queryByDisplayValue('Utilities')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Save Utilities' }))

    expect(updateCategory).toHaveBeenCalledWith(3, { color: '#0066b2' })
  })

  it('cancels an in-progress edit without saving', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
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
    vi.mocked(updateCategory).mockRejectedValue(new ApiError(500, 'Could not save changes'))
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    await user.click(screen.getByRole('button', { name: 'Save Groceries' }))

    expect(await screen.findByText('Could not save changes')).toBeInTheDocument()
  })

  it('does not offer Delete on an active category, only once archived', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Show archived / removed' }))
    await screen.findByText('Groceries')
    expect(screen.queryByRole('button', { name: 'Delete Groceries' })).toBeNull()
  })

  it('permanently removes an archived category after confirming', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listCategories).mockResolvedValue([archived, rent])
    vi.mocked(deleteCategory).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Show archived / removed' }))
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
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Show archived / removed' }))
    await user.click(await screen.findByRole('button', { name: 'Delete Groceries' }))

    expect(deleteCategory).not.toHaveBeenCalled()
  })

  it('shows an error when permanently removing fails', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listCategories).mockResolvedValue([archived])
    vi.mocked(deleteCategory).mockRejectedValue(new ApiError(500, 'Failed to remove'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Show archived / removed' }))
    await user.click(await screen.findByRole('button', { name: 'Delete Groceries' }))

    expect(await screen.findByText('Failed to remove')).toBeInTheDocument()
  })

  it('archives a category and can be unarchived', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, isArchived: true })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Show archived / removed' }))
    await screen.findByText('Groceries')
    vi.mocked(listCategories).mockResolvedValue([{ ...groceries, isArchived: true }])
    await user.click(screen.getByRole('button', { name: 'Archive Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, { isArchived: true })
    await waitFor(() => expect(screen.getAllByText('Archived').length).toBeGreaterThan(0))

    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, isArchived: false })
    vi.mocked(listCategories).mockResolvedValue([groceries])
    await user.click(screen.getByRole('button', { name: 'Unarchive Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, { isArchived: false })
  })

  it('restores a removed category', async () => {
    const removed = { ...groceries, isActive: false }
    vi.mocked(listCategories).mockResolvedValue([removed])
    vi.mocked(updateCategory).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Show archived / removed' }))
    await waitFor(() => expect(screen.getAllByText('Removed').length).toBeGreaterThan(0))
    vi.mocked(listCategories).mockResolvedValue([groceries])
    await user.click(screen.getByRole('button', { name: 'Restore Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, { isActive: true })
  })

  it('moves a category down and up, swapping sort order', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
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
    vi.mocked(updateCategory).mockRejectedValue(new ApiError(500, 'Failed to reorder'))
    const user = userEvent.setup()
    render(CategoriesPage)

    const downButtons = await screen.findAllByRole('button', { name: /Move .* down/ })
    await user.click(downButtons[0]!)

    expect(await screen.findByText('Failed to reorder')).toBeInTheDocument()
  })
})
