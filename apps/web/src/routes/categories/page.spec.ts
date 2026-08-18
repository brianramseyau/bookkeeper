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
  parentId: null,
  isActive: true,
  isArchived: false,
  isSystem: false,
}

const rent: Category = {
  id: 2,
  name: 'Rent',
  color: null,
  sortOrder: 2,
  parentId: null,
  isActive: true,
  isArchived: false,
  isSystem: false,
}

const utilities: Category = {
  id: 3,
  name: 'Utilities',
  color: '#0066b2',
  sortOrder: 0,
  parentId: null,
  isActive: true,
  isArchived: false,
  isSystem: true,
}

const produce: Category = {
  ...groceries,
  id: 4,
  name: 'Produce',
  sortOrder: 0,
  parentId: 1,
}

const bakery: Category = {
  ...groceries,
  id: 5,
  name: 'Bakery',
  sortOrder: 1,
  parentId: 1,
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

  it('shows an empty state when there are no categories', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    render(CategoriesPage)

    await screen.findByPlaceholderText('Add a category (e.g. Household)')
    expect(screen.queryByText('Groceries')).toBeNull()
    expect(screen.getByText('No categories yet.')).toBeInTheDocument()
  })

  it('renders active categories', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    render(CategoriesPage)

    expect(await screen.findByRole('button', { name: 'Edit Groceries' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Rent' })).toBeInTheDocument()
  })

  it('nests child categories under their parent by default', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, produce, bakery])
    render(CategoriesPage)

    await screen.findByRole('button', { name: 'Collapse Groceries' })
    expect(screen.getByRole('button', { name: 'Edit Produce' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Bakery' })).toBeInTheDocument()
  })

  it('collapses and expands a parent with its chevron', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, produce])
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByRole('button', { name: 'Collapse Groceries' })
    await user.click(screen.getByRole('button', { name: 'Collapse Groceries' }))
    expect(screen.queryByRole('button', { name: 'Edit Produce' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Expand Groceries' }))
    expect(screen.getByRole('button', { name: 'Edit Produce' })).toBeInTheDocument()
  })

  it('unfolds less and unfolds more across all parents', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, produce, rent])
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByRole('button', { name: 'Collapse Groceries' })
    await user.click(screen.getByRole('button', { name: 'Unfold less' }))
    expect(screen.queryByRole('button', { name: 'Edit Produce' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Unfold more' }))
    expect(screen.getByRole('button', { name: 'Edit Produce' })).toBeInTheDocument()
  })

  it('hides the unfold toggle when there are no nested categories', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    render(CategoriesPage)

    await screen.findByRole('button', { name: 'Edit Groceries' })
    expect(screen.queryByRole('button', { name: /^Unfold/ })).toBeNull()
  })

  it('shows a System badge for the system category and no Archive button for it', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, utilities])
    render(CategoriesPage)

    await screen.findByRole('button', { name: 'Edit Utilities' })
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
    expect(await screen.findByRole('button', { name: 'Edit Groceries' })).toBeInTheDocument()
  })

  it('adds a child category when a parent is selected', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(createCategory).mockResolvedValue({ ...produce, name: 'Produce' })
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByPlaceholderText('Add a category (e.g. Household)')
    await user.type(screen.getByPlaceholderText('Add a category (e.g. Household)'), 'Produce')
    await user.selectOptions(screen.getByLabelText('Parent (optional)'), '1')
    await user.click(screen.getByRole('button', { name: 'Add category' }))

    expect(createCategory).toHaveBeenCalledWith({ name: 'Produce', parentId: 1 })
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
    expect(await screen.findByRole('button', { name: 'Edit Food' })).toBeInTheDocument()
  })

  it('moves a category under a parent from the edit form', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, parentId: 2 })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    await user.selectOptions(screen.getByLabelText('Parent for Groceries'), '2')
    await user.click(screen.getByRole('button', { name: 'Save Groceries' }))

    expect(updateCategory).toHaveBeenCalledWith(1, {
      name: 'Groceries',
      color: '#22c55e',
      parentId: 2,
    })
  })

  it('edits a nested child category', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, produce])
    vi.mocked(updateCategory).mockResolvedValue({ ...produce, name: 'Fresh Produce' })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Produce' }))
    const nameInput = screen.getByDisplayValue('Produce')
    await user.clear(nameInput)
    await user.type(nameInput, 'Fresh Produce')
    await user.click(screen.getByRole('button', { name: 'Save Produce' }))

    expect(updateCategory).toHaveBeenCalledWith(4, {
      name: 'Fresh Produce',
      color: '#22c55e',
    })
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
    expect(await screen.findByRole('button', { name: 'Edit Groceries' })).toBeInTheDocument()
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
    await screen.findByRole('button', { name: 'Edit Groceries' })
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
    await screen.findByRole('button', { name: 'Archive Groceries' })
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

  it('drags a top-level category to a new position, swapping sort order', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    vi.mocked(updateCategory).mockResolvedValue(groceries)
    const { container } = render(CategoriesPage)

    await screen.findByRole('button', { name: 'Edit Groceries' })
    const zone = container.querySelector('[role="list"]')!
    zone.dispatchEvent(
      new CustomEvent('finalize', {
        detail: {
          items: [rent, groceries],
          info: { trigger: 'droppedIntoZone', id: '2', source: 'pointer' },
        },
      })
    )

    expect(updateCategory).toHaveBeenCalledWith(1, { sortOrder: 2 })
    expect(updateCategory).toHaveBeenCalledWith(2, { sortOrder: 1 })
  })

  it('drags a child to a new position within its parent, swapping sort order', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, produce, bakery])
    vi.mocked(updateCategory).mockResolvedValue(produce)
    const { container } = render(CategoriesPage)

    await screen.findByRole('button', { name: 'Edit Produce' })
    const zones = container.querySelectorAll('[role="list"]')
    const childrenZone = zones[1]!
    childrenZone.dispatchEvent(
      new CustomEvent('finalize', {
        detail: {
          items: [bakery, produce],
          info: { trigger: 'droppedIntoZone', id: '5', source: 'pointer' },
        },
      })
    )

    expect(updateCategory).toHaveBeenCalledWith(4, { sortOrder: 1 })
    expect(updateCategory).toHaveBeenCalledWith(5, { sortOrder: 0 })
  })

  it('shows an error when reordering fails', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    vi.mocked(updateCategory).mockRejectedValue(new ApiError(500, 'Failed to reorder'))
    const { container } = render(CategoriesPage)

    await screen.findByRole('button', { name: 'Edit Groceries' })
    const zone = container.querySelector('[role="list"]')!
    zone.dispatchEvent(
      new CustomEvent('finalize', {
        detail: {
          items: [rent, groceries],
          info: { trigger: 'droppedIntoZone', id: '2', source: 'pointer' },
        },
      })
    )

    expect(await screen.findByText('Failed to reorder')).toBeInTheDocument()
  })
})
