import { fireEvent, render, screen, within } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { Category } from '$lib/api/categories'
import CategoryFormSheet from './CategoryFormSheet.svelte'

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
  ...groceries,
  id: 3,
  name: 'Utilities',
  isSystem: true,
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    category: null,
    parentOptions: [groceries, rent],
    hasChildren: false,
    submitting: false,
    onSubmit: vi.fn(),
    ...overrides,
  }
}

function sheet() {
  return screen.getByRole('dialog', { hidden: true })
}

describe('CategoryFormSheet', () => {
  it('requires a name before submitting an add', async () => {
    const onSubmit = vi.fn()
    render(CategoryFormSheet, baseProps({ onSubmit }))

    await fireEvent.click(within(sheet()).getByRole('button', { name: 'Add category' }))

    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the entered name, color and parent', async () => {
    const onSubmit = vi.fn()
    render(CategoryFormSheet, baseProps({ onSubmit }))

    await fireEvent.input(within(sheet()).getByLabelText('Name'), {
      target: { value: 'Produce' },
    })
    await fireEvent.change(within(sheet()).getByLabelText('Parent'), { target: { value: '2' } })
    await fireEvent.click(within(sheet()).getByRole('button', { name: 'Add category' }))

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Produce', color: '#64748b', parentId: 2 })
  })

  it('prefills an edit and submits changes', async () => {
    const onSubmit = vi.fn()
    render(CategoryFormSheet, baseProps({ category: groceries, onSubmit }))

    expect(within(sheet()).getByLabelText('Name')).toHaveValue('Groceries')

    await fireEvent.input(within(sheet()).getByLabelText('Name'), { target: { value: 'Food' } })
    await fireEvent.click(within(sheet()).getByRole('button', { name: 'Save changes' }))

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Food', color: '#22c55e', parentId: null })
  })

  it('hides the rename field for a system category', () => {
    render(CategoryFormSheet, baseProps({ category: utilities }))

    expect(within(sheet()).queryByLabelText('Name')).toBeNull()
    expect(
      screen.getByText('This is a system category - only its color can change.')
    ).toBeInTheDocument()
  })

  it('disables the parent select for a category with children', () => {
    render(CategoryFormSheet, baseProps({ category: groceries, hasChildren: true }))

    expect(within(sheet()).getByLabelText('Parent')).toBeDisabled()
    expect(screen.getByText('A category with children stays at the top level.')).toBeInTheDocument()
  })
})
