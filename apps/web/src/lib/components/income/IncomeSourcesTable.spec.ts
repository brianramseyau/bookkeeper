import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { IncomeSource } from '$lib/api/income'
import IncomeSourcesTable from './IncomeSourcesTable.svelte'

const brianSalary: IncomeSource = {
  id: 1,
  userId: 1,
  name: 'Brian Income',
  expectedAmount: 5000,
  frequency: 'monthly',
  payDayOfMonth: 14,
  weekendRollback: true,
  anchorDate: null,
  taxWithheld: true,
  isActive: true,
  notes: null,
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    sources: [brianSalary],
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
}

describe('IncomeSourcesTable', () => {
  it('renders a source with its amount, cadence and tax flag', () => {
    render(IncomeSourcesTable, baseProps())

    expect(screen.getByText('Brian Income')).toBeInTheDocument()
    expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Monthly, day 14 (or preceding Fri)')).toBeInTheDocument()
    expect(screen.getAllByText('Yes').length).toBeGreaterThan(0)
  })

  it('shows an empty state when there are no sources', () => {
    render(IncomeSourcesTable, baseProps({ sources: [] }))

    expect(screen.getByText('No income sources yet.')).toBeInTheDocument()
  })

  it('calls onEdit and onDelete', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(IncomeSourcesTable, baseProps({ onEdit, onDelete }))

    await user.click(screen.getAllByRole('button', { name: 'Edit Brian Income' })[0]!)
    await user.click(screen.getAllByRole('button', { name: 'Delete Brian Income' })[0]!)

    expect(onEdit).toHaveBeenCalledWith(brianSalary)
    expect(onDelete).toHaveBeenCalledWith(brianSalary)
  })
})
