import { render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { IncomeEntry, IncomeSource } from '$lib/api/income'
import IncomeEntriesTable from './IncomeEntriesTable.svelte'

const brianSalary: IncomeSource = {
  id: 1,
  userId: 1,
  name: 'Brian Income',
  expectedAmount: 5000,
  frequency: 'monthly',
  payDayOfMonth: 14,
  weekendRollback: false,
  anchorDate: null,
  taxWithheld: true,
  isActive: true,
  notes: null,
}

const salaryEntry: IncomeEntry = {
  id: 10,
  incomeSourceId: 1,
  userId: null,
  year: 2026,
  month: 8,
  receivedOn: '2025-08-14T00:00:00.000+00:00',
  amount: 5000,
  note: 'Payslip',
  taxWithheld: null,
}

const otherEntry: IncomeEntry = {
  id: 20,
  incomeSourceId: null,
  userId: 1,
  year: 2026,
  month: 8,
  receivedOn: '2025-08-13T00:00:00.000+00:00',
  amount: 1000,
  note: 'Share sale',
  taxWithheld: false,
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    entries: [otherEntry],
    sources: [brianSalary],
    marginalRate: 0.37,
    totals: { amount: 1000, tax: 370, gain: 630 },
    hasOther: true,
    emptyMessage: 'Nothing here',
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
}

describe('IncomeEntriesTable', () => {
  it('shows the source name for a salary entry and the note for other income', () => {
    render(IncomeEntriesTable, baseProps({ entries: [salaryEntry, otherEntry] }))

    expect(screen.getByText('Brian Income')).toBeInTheDocument()
    expect(screen.getByText('Payslip')).toBeInTheDocument()
    expect(screen.getByText('Share sale')).toBeInTheDocument()
  })

  it('computes tax and gain for other income, and dashes for salary', () => {
    render(IncomeEntriesTable, baseProps({ entries: [salaryEntry, otherEntry] }))

    const salaryRow = screen.getByText('Brian Income').closest('tr')!
    expect(within(salaryRow).getAllByText('—').length).toBeGreaterThanOrEqual(2)

    const otherRow = screen.getByText('Share sale').closest('tr')!
    expect(within(otherRow).getByText('$370.00')).toBeInTheDocument()
    expect(within(otherRow).getByText('$630.00')).toBeInTheDocument()
  })

  it('renders the footer totals', () => {
    render(IncomeEntriesTable, baseProps())

    // $1,000.00/$370.00/$630.00 each appear in both the row and the footer.
    expect(screen.getAllByText('$1,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$370.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$630.00').length).toBeGreaterThan(0)
  })

  it('dashes the footer tax/gain when no shown entry is other income', () => {
    render(IncomeEntriesTable, baseProps({ entries: [salaryEntry], hasOther: false }))

    const footer = document.querySelector('tfoot')!
    expect(within(footer).getAllByText('—').length).toBe(2)
  })

  it('shows the empty message with no entries', () => {
    render(IncomeEntriesTable, baseProps({ entries: [], hasOther: false }))

    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('calls onEdit and onDelete', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(IncomeEntriesTable, baseProps({ onEdit, onDelete }))

    await user.click(screen.getAllByRole('button', { name: 'Edit entry from 13 Aug 2025' }).at(-1)!)
    await user.click(
      screen.getAllByRole('button', { name: 'Delete entry from 13 Aug 2025' }).at(-1)!
    )

    expect(onEdit).toHaveBeenCalledWith(otherEntry)
    expect(onDelete).toHaveBeenCalledWith(otherEntry)
  })
})
