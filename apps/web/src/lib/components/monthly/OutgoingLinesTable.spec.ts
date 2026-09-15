import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StandardMonthLine } from '$lib/api/standard-month'
import OutgoingLinesTable from './OutgoingLinesTable.svelte'

function makeLine(overrides: Partial<StandardMonthLine> = {}): StandardMonthLine {
  return {
    key: 'recurring-bill-1',
    label: 'Internet',
    projected: 80,
    actual: 75,
    dueDay: 12,
    dueDate: null,
    dueDateEstimated: false,
    paid: false,
    estimated: false,
    editable: true,
    receivedOn: null,
    ...overrides,
  }
}

function baseProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    year: 2026,
    month: 3,
    lines: [makeLine()],
    projectedTotal: 80,
    actualTotal: 75,
    editingExpenseKey: null,
    editExpenseMode: null,
    editActualsExpenseId: null,
    editExpenseAmount: NaN,
    editExpenseReceivedOn: '',
    savingExpense: false,
    savingPaidKey: null,
    onStartEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onRemoveActual: vi.fn(),
    onTogglePaid: vi.fn(),
    ...overrides,
  }
}

describe('OutgoingLinesTable', () => {
  it('renders a line with its projected/actual totals', () => {
    render(OutgoingLinesTable, baseProps())

    expect(screen.getByText('Internet')).toBeInTheDocument()
    // $80.00/$75.00 each appear twice - once in the row, once in the footer total.
    expect(screen.getAllByText('$80.00')).toHaveLength(2)
    expect(screen.getAllByText('$75.00')).toHaveLength(2)
  })

  it('calls onStartEdit when the edit button is clicked', async () => {
    const onStartEdit = vi.fn()
    const user = userEvent.setup()
    render(OutgoingLinesTable, baseProps({ onStartEdit }))

    await user.click(screen.getAllByRole('button', { name: 'Edit Internet' })[0]!)
    expect(onStartEdit).toHaveBeenCalledWith(expect.objectContaining({ key: 'recurring-bill-1' }))
  })

  it('calls onTogglePaid when the paid checkbox changes', async () => {
    const onTogglePaid = vi.fn()
    const user = userEvent.setup()
    render(OutgoingLinesTable, baseProps({ onTogglePaid }))

    await user.click(screen.getAllByLabelText('Paid')[0]!)
    expect(onTogglePaid).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'recurring-bill-1' }),
      true
    )
  })

  it('shows edit inputs and calls onSaveEdit/onCancelEdit while editing', async () => {
    const onSaveEdit = vi.fn()
    const onCancelEdit = vi.fn()
    const user = userEvent.setup()
    render(
      OutgoingLinesTable,
      baseProps({
        editingExpenseKey: 'recurring-bill-1',
        editExpenseMode: 'recurring-bill',
        editExpenseAmount: 80,
        onSaveEdit,
        onCancelEdit,
      })
    )

    expect(screen.getByDisplayValue('80')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Save Internet' })[0]!)
    expect(onSaveEdit).toHaveBeenCalledOnce()
    await user.click(screen.getAllByRole('button', { name: 'Cancel editing Internet' })[0]!)
    expect(onCancelEdit).toHaveBeenCalledOnce()
  })

  it('shows a delete button and calls onRemoveActual for an expense-edit line', async () => {
    const onRemoveActual = vi.fn()
    const user = userEvent.setup()
    render(
      OutgoingLinesTable,
      baseProps({
        lines: [makeLine({ key: 'expense-1', label: 'Groceries' })],
        editingExpenseKey: 'expense-1',
        editExpenseMode: 'expense-edit',
        editExpenseAmount: 200,
        onRemoveActual,
      })
    )

    await user.click(screen.getAllByRole('button', { name: 'Delete Groceries entry' })[0]!)
    expect(onRemoveActual).toHaveBeenCalledOnce()
  })
})
