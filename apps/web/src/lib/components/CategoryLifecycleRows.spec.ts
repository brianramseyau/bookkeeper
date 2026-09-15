import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Category } from '$lib/api/categories'
import CategoryLifecycleRows from './CategoryLifecycleRows.svelte'

const groceries: Category = {
  id: 1,
  name: 'Groceries',
  color: '#22c55e',
  sortOrder: 1,
  parentId: null,
  isActive: true,
  isArchived: true,
  isSystem: false,
}

const removed: Category = {
  ...groceries,
  id: 6,
  name: 'Old Tag',
  isActive: false,
  isArchived: false,
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    categories: [groceries],
    parentNameFor: vi.fn().mockReturnValue(null),
    onEdit: vi.fn(),
    onLifecycle: vi.fn(),
    ...overrides,
  }
}

describe('CategoryLifecycleRows', () => {
  it('offers edit, unarchive and delete for an archived category', async () => {
    const onEdit = vi.fn()
    const onLifecycle = vi.fn()
    const user = userEvent.setup()
    render(CategoryLifecycleRows, baseProps({ onEdit, onLifecycle }))

    await user.click(screen.getByRole('button', { name: 'Edit Groceries' }))
    await user.click(screen.getByRole('button', { name: 'Unarchive Groceries' }))
    await user.click(screen.getByRole('button', { name: 'Delete Groceries' }))

    expect(onEdit).toHaveBeenCalledWith(groceries)
    expect(onLifecycle).toHaveBeenCalledWith(groceries, 'unarchive')
    expect(onLifecycle).toHaveBeenCalledWith(groceries, 'delete')
  })

  it('offers only restore for a removed category', async () => {
    const onLifecycle = vi.fn()
    const user = userEvent.setup()
    render(CategoryLifecycleRows, baseProps({ categories: [removed], onLifecycle }))

    await user.click(screen.getByRole('button', { name: 'Restore Old Tag' }))

    expect(onLifecycle).toHaveBeenCalledWith(removed, 'restore')
    expect(screen.queryByRole('button', { name: 'Delete Old Tag' })).toBeNull()
  })

  it('shows the parent caption when a parent name resolves', () => {
    render(
      CategoryLifecycleRows,
      baseProps({
        categories: [{ ...groceries, parentId: 2 }],
        parentNameFor: vi.fn().mockReturnValue('Rent'),
      })
    )

    expect(screen.getByText('under Rent')).toBeInTheDocument()
  })
})
