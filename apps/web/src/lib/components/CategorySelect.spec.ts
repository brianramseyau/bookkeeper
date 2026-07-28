import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { Category } from '$lib/api/categories'
import CategorySelect from './CategorySelect.svelte'

const categories: Category[] = [
  {
    id: 1,
    name: 'Groceries',
    color: null,
    sortOrder: 0,
    budgetAmount: null,
    budgetItemCount: 0,
    includeInStandardMonth: true,
    isActive: true,
    isPaused: false,
    isArchived: false,
  },
  {
    id: 2,
    name: 'Utilities',
    color: null,
    sortOrder: 1,
    budgetAmount: null,
    budgetItemCount: 0,
    includeInStandardMonth: true,
    isActive: true,
    isPaused: false,
    isArchived: false,
  },
]

describe('CategorySelect', () => {
  it('renders an Uncategorized option plus one per category', () => {
    const { getByText } = render(CategorySelect, { categories, value: '', onchange: vi.fn() })
    expect(getByText('Uncategorized')).toBeInTheDocument()
    expect(getByText('Groceries')).toBeInTheDocument()
    expect(getByText('Utilities')).toBeInTheDocument()
  })

  it('reflects the selected value', () => {
    const { container } = render(CategorySelect, { categories, value: 2, onchange: vi.fn() })
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('2')
  })

  it('falls back to the empty option when value is null', () => {
    const { container } = render(CategorySelect, { categories, value: null, onchange: vi.fn() })
    expect((container.querySelector('select') as HTMLSelectElement).value).toBe('')
  })

  it('calls onchange with the new value when the selection changes', async () => {
    const onchange = vi.fn()
    const { container } = render(CategorySelect, { categories, value: '', onchange })
    const select = container.querySelector('select') as HTMLSelectElement
    await fireEvent.change(select, { target: { value: '1' } })
    expect(onchange).toHaveBeenCalledWith('1')
  })

  it('uses the compact table variant classes when requested', () => {
    const { container } = render(CategorySelect, {
      categories,
      value: '',
      onchange: vi.fn(),
      variant: 'table',
    })
    expect(container.querySelector('select')?.className).toContain('text-xs')
  })
})
