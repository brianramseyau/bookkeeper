import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'svelte-sonner'
import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
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
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('$lib/components/app/confirmDestructive.svelte', () => ({
  confirmDestructive: vi.fn(),
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

// The Sheet/Drawer the form opens into is portalled onto `document.body`.
function openSheet() {
  return screen.getByRole('dialog', { hidden: true })
}

function waitForBodyInteractive() {
  return waitFor(() => expect(getComputedStyle(document.body).pointerEvents).not.toBe('none'))
}

describe('categories page', () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockReset()
    vi.mocked(createCategory).mockReset()
    vi.mocked(updateCategory).mockReset()
    vi.mocked(deleteCategory).mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(confirmDestructive).mockReset().mockResolvedValue(true)
  })

  it('shows a loading state, then an error on failure', async () => {
    vi.mocked(listCategories).mockRejectedValue(new ApiError(500, 'Could not load categories'))
    render(CategoriesPage)

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
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

    expect(await screen.findByText('No categories yet.')).toBeInTheDocument()
    expect(screen.queryByText('Groceries')).toBeNull()
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

  it('adds a new category in a sheet and reloads the list', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(createCategory).mockResolvedValue(groceries)
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByText('No categories yet.')
    vi.mocked(listCategories).mockResolvedValue([groceries])

    await user.click(screen.getByRole('button', { name: 'Add category' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: 'Groceries' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add category' }))

    await waitFor(() =>
      expect(createCategory).toHaveBeenCalledWith({ name: 'Groceries', color: '#64748b' })
    )
    expect(toast.success).toHaveBeenCalledWith('Category added')
    expect(await screen.findByRole('button', { name: 'Edit Groceries' })).toBeInTheDocument()
  })

  it('adds a child category when a parent is selected', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(createCategory).mockResolvedValue({ ...produce, name: 'Produce' })
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByRole('button', { name: 'Edit Groceries' })
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: 'Produce' } })
    await fireEvent.change(within(sheet).getByLabelText('Parent'), { target: { value: '1' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add category' }))

    await waitFor(() =>
      expect(createCategory).toHaveBeenCalledWith({
        name: 'Produce',
        color: '#64748b',
        parentId: 1,
      })
    )
  })

  it('requires a name to add a category', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByText('No categories yet.')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: '   ' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add category' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(createCategory).not.toHaveBeenCalled()
  })

  it('shows an error when adding a category fails', async () => {
    vi.mocked(listCategories).mockResolvedValue([])
    vi.mocked(createCategory).mockRejectedValue(new ApiError(422, 'Name already exists'))
    const user = userEvent.setup()
    render(CategoriesPage)

    await screen.findByText('No categories yet.')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: 'Groceries' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Add category' }))

    expect(await screen.findByText('Name already exists')).toBeInTheDocument()
  })

  it('edits a category in a sheet, saving its name and color', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, name: 'Food' })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const sheet = openSheet()
    const nameInput = within(sheet).getByLabelText('Name')
    await fireEvent.input(nameInput, { target: { value: 'Food' } })

    vi.mocked(listCategories).mockResolvedValue([{ ...groceries, name: 'Food' }])
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(updateCategory).toHaveBeenCalledWith(1, {
        name: 'Food',
        color: '#22c55e',
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Category saved')
    expect(await screen.findByRole('button', { name: 'Edit Food' })).toBeInTheDocument()
  })

  it('moves a category under a parent from the edit sheet', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, rent])
    vi.mocked(updateCategory).mockResolvedValue({ ...groceries, parentId: 2 })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const sheet = openSheet()
    await fireEvent.change(within(sheet).getByLabelText('Parent'), { target: { value: '2' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(updateCategory).toHaveBeenCalledWith(1, {
        name: 'Groceries',
        color: '#22c55e',
        parentId: 2,
      })
    )
  })

  it('edits a nested child category', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries, produce])
    vi.mocked(updateCategory).mockResolvedValue({ ...produce, name: 'Fresh Produce' })
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Produce' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), {
      target: { value: 'Fresh Produce' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(updateCategory).toHaveBeenCalledWith(4, {
        name: 'Fresh Produce',
        color: '#22c55e',
      })
    )
  })

  it('does not render a rename input for the system category, only saving its color', async () => {
    vi.mocked(listCategories).mockResolvedValue([utilities])
    vi.mocked(updateCategory).mockResolvedValue(utilities)
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Utilities' }))
    const sheet = openSheet()

    expect(within(sheet).queryByLabelText('Name')).toBeNull()

    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(updateCategory).toHaveBeenCalledWith(3, { color: '#0066b2' }))
  })

  it('cancels an in-progress edit without saving', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), {
      target: { value: 'Should not save' },
    })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    await waitForBodyInteractive()

    expect(updateCategory).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Edit Groceries' })).toBeInTheDocument()
  })

  it('requires a name when saving an edit', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Name'), { target: { value: '' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Name is required')).toBeInTheDocument()
    expect(updateCategory).not.toHaveBeenCalled()
  })

  it('shows an error when saving an edit fails', async () => {
    vi.mocked(listCategories).mockResolvedValue([groceries])
    vi.mocked(updateCategory).mockRejectedValue(new ApiError(500, 'Could not save changes'))
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const sheet = openSheet()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

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
    const user = userEvent.setup()
    render(CategoriesPage)

    await user.click(await screen.findByRole('button', { name: 'Show archived / removed' }))
    await screen.findByText('Groceries')
    vi.mocked(listCategories).mockResolvedValue([rent])
    await user.click(screen.getByRole('button', { name: 'Delete Groceries' }))

    expect(confirmDestructive).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete Groceries?' })
    )
    expect(deleteCategory).toHaveBeenCalledWith(1)
    expect(toast.success).toHaveBeenCalledWith('Groceries deleted')
    await waitFor(() => expect(screen.queryByText('Groceries')).toBeNull())
  })

  it('does not remove an archived category when the confirmation is declined', async () => {
    const archived = { ...groceries, isArchived: true }
    vi.mocked(listCategories).mockResolvedValue([archived])
    vi.mocked(confirmDestructive).mockResolvedValue(false)
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

    await waitFor(() => expect(updateCategory).toHaveBeenCalledWith(1, { isArchived: true }))
    expect(toast.success).toHaveBeenCalledWith('Groceries archived')
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
