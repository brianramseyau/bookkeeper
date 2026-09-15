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
    savingPaidKey: null,
    onStartEdit: vi.fn(),
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

  it('does not show an edit button for a non-editable line', () => {
    render(
      OutgoingLinesTable,
      baseProps({
        lines: [makeLine({ key: 'utility-2', label: 'Water (shared)', editable: false })],
      })
    )

    expect(screen.queryByRole('button', { name: 'Edit Water (shared)' })).toBeNull()
  })
})
