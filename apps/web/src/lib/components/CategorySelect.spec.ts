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
    parentId: null,
    isActive: true,
    isArchived: false,
    isSystem: false,
  },
  {
    id: 2,
    name: 'Utilities',
    color: null,
    sortOrder: 1,
    parentId: null,
    isActive: true,
    isArchived: false,
    isSystem: true,
  },
]

const groceriesChild: Category = {
  ...categories[0]!,
  id: 3,
  name: 'Produce',
  sortOrder: 0,
  parentId: 1,
}

describe('CategorySelect', () => {
  it('renders an Uncategorized option plus one per category', () => {
    const { getByText } = render(CategorySelect, { categories, value: '', onchange: vi.fn() })
    expect(getByText('Uncategorized')).toBeInTheDocument()
    expect(getByText('Groceries')).toBeInTheDocument()
    expect(getByText('Utilities')).toBeInTheDocument()
  })

  it('indents child categories under their parent', () => {
    const { container } = render(CategorySelect, {
      categories: [categories[0]!, groceriesChild],
      value: '',
      onchange: vi.fn(),
    })
    const options = Array.from(container.querySelectorAll('option')).map((o) => o.textContent)
    expect(options).toContain('Groceries')
    expect(options).toContain('\u00A0\u00A0\u00A0↳ Produce')
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
