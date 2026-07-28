import { createRawSnippet } from 'svelte'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import IncomeEntryEditRow from './IncomeEntryEditRow.svelte'

const leading = createRawSnippet(() => ({
  render: () => '<td>Salary</td>',
}))

describe('IncomeEntryEditRow', () => {
  it('initializes its inputs from the initial* props', () => {
    const { container } = render(IncomeEntryEditRow, {
      initialAmount: 123.45,
      initialReceivedOn: '2026-01-05',
      initialNote: 'bonus',
      saving: false,
      leading,
      onSave: vi.fn(),
      onCancel: vi.fn(),
    })
    const inputs = container.querySelectorAll('input')
    expect((inputs[0] as HTMLInputElement).value).toBe('123.45')
    expect((inputs[1] as HTMLInputElement).value).toBe('2026-01-05')
    expect((inputs[2] as HTMLInputElement).value).toBe('bonus')
  })

  it('calls onSave with edited values, nulling blank date/note', async () => {
    const onSave = vi.fn()
    const { container } = render(IncomeEntryEditRow, {
      initialAmount: 100,
      initialReceivedOn: '',
      initialNote: '',
      saving: false,
      leading,
      onSave,
      onCancel: vi.fn(),
    })
    const inputs = container.querySelectorAll('input')
    await fireEvent.input(inputs[0]!, { target: { value: '200' } })
    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save'
    )!
    await fireEvent.click(saveButton)
    expect(onSave).toHaveBeenCalledWith({ amount: 200, receivedOn: null, note: null })
  })

  it('trims note and passes through a set date', async () => {
    const onSave = vi.fn()
    const { container } = render(IncomeEntryEditRow, {
      initialAmount: 100,
      initialReceivedOn: '2026-02-01',
      initialNote: '  hello  ',
      saving: false,
      leading,
      onSave,
      onCancel: vi.fn(),
    })
    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save'
    )!
    await fireEvent.click(saveButton)
    expect(onSave).toHaveBeenCalledWith({
      amount: 100,
      receivedOn: '2026-02-01',
      note: 'hello',
    })
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn()
    const { container } = render(IncomeEntryEditRow, {
      initialAmount: 100,
      initialReceivedOn: '',
      initialNote: '',
      saving: false,
      leading,
      onSave: vi.fn(),
      onCancel,
    })
    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    )!
    await fireEvent.click(cancelButton)
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables the Save button while saving', () => {
    const { container } = render(IncomeEntryEditRow, {
      initialAmount: 100,
      initialReceivedOn: '',
      initialNote: '',
      saving: true,
      leading,
      onSave: vi.fn(),
      onCancel: vi.fn(),
    })
    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save'
    )!
    expect(saveButton.disabled).toBe(true)
  })

  it('renders the leading snippet content', () => {
    const { getByText } = render(IncomeEntryEditRow, {
      initialAmount: 100,
      initialReceivedOn: '',
      initialNote: '',
      saving: false,
      leading,
      onSave: vi.fn(),
      onCancel: vi.fn(),
    })
    expect(getByText('Salary')).toBeInTheDocument()
  })
})
