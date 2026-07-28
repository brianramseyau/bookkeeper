import { createRawSnippet } from 'svelte'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import IncomeEntryDisplayRow from './IncomeEntryDisplayRow.svelte'

const leading = createRawSnippet(() => ({
  render: () => '<td>Salary</td>',
}))

describe('IncomeEntryDisplayRow', () => {
  it('renders the amount, date, and note', () => {
    const { getByText } = render(IncomeEntryDisplayRow, {
      amount: 1234.5,
      receivedOn: '2026-01-05',
      note: 'bonus',
      leading,
      onEdit: vi.fn(),
      onRemove: vi.fn(),
    })
    expect(getByText('$1,234.50')).toBeInTheDocument()
    expect(getByText('bonus')).toBeInTheDocument()
  })

  it('shows an em dash when note is null', () => {
    const { getAllByText } = render(IncomeEntryDisplayRow, {
      amount: 100,
      receivedOn: null,
      note: null,
      leading,
      onEdit: vi.fn(),
      onRemove: vi.fn(),
    })
    expect(getAllByText('—').length).toBeGreaterThan(0)
  })

  it('calls onEdit when Edit is clicked', async () => {
    const onEdit = vi.fn()
    const { getByText } = render(IncomeEntryDisplayRow, {
      amount: 100,
      receivedOn: null,
      note: null,
      leading,
      onEdit,
      onRemove: vi.fn(),
    })
    await fireEvent.click(getByText('Edit'))
    expect(onEdit).toHaveBeenCalled()
  })

  it('calls onRemove when Remove is clicked', async () => {
    const onRemove = vi.fn()
    const { getByText } = render(IncomeEntryDisplayRow, {
      amount: 100,
      receivedOn: null,
      note: null,
      leading,
      onEdit: vi.fn(),
      onRemove,
    })
    await fireEvent.click(getByText('Remove'))
    expect(onRemove).toHaveBeenCalled()
  })

  it('renders the leading snippet content', () => {
    const { getByText } = render(IncomeEntryDisplayRow, {
      amount: 100,
      receivedOn: null,
      note: null,
      leading,
      onEdit: vi.fn(),
      onRemove: vi.fn(),
    })
    expect(getByText('Salary')).toBeInTheDocument()
  })

  it('applies a custom amount value class', () => {
    const { getByText } = render(IncomeEntryDisplayRow, {
      amount: 100,
      receivedOn: null,
      note: null,
      leading,
      onEdit: vi.fn(),
      onRemove: vi.fn(),
      amountValueClass: 'text-slate-900 dark:text-slate-100',
    })
    expect(getByText('$100.00').className).toContain('text-slate-900')
  })
})
