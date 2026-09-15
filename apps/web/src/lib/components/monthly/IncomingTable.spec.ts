import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { StandardMonthIncomeLine } from '$lib/api/standard-month'
import type { IncomeEntry } from '$lib/api/income'
import type { UserSummary } from '$lib/api/users'
import IncomingTable from './IncomingTable.svelte'

const brian: UserSummary = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: null,
  initials: 'B',
}

function makeLine(overrides: Partial<StandardMonthIncomeLine> = {}): StandardMonthIncomeLine {
  return {
    key: 'income-1',
    label: 'Brian Income',
    sourceId: 1,
    userId: 1,
    projected: 5000,
    actual: 5000,
    estimated: false,
    payDates: ['2026-03-14T00:00:00.000+00:00'],
    ...overrides,
  }
}

const salaryEntry: IncomeEntry = {
  id: 10,
  incomeSourceId: 1,
  userId: null,
  year: 2026,
  month: 3,
  receivedOn: '2026-03-14T00:00:00.000+00:00',
  amount: 5000,
  note: 'March pay',
  taxWithheld: null,
}

function baseProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    lines: [makeLine()],
    entries: [salaryEntry],
    users: [brian],
    projectedTotal: 5000,
    actualTotal: 5000,
    acceptingPlaceholderKey: null,
    onEditEntry: vi.fn(),
    onDeleteEntry: vi.fn(),
    onEditPlaceholder: vi.fn(),
    onAcceptPlaceholder: vi.fn(),
    ...overrides,
  }
}

describe('IncomingTable', () => {
  it('renders a source line and its matching logged entry', () => {
    render(IncomingTable, baseProps())

    expect(screen.getByText('Brian Income')).toBeInTheDocument()
    expect(screen.getByText('Brian')).toBeInTheDocument()
    expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0)
  })

  it('calls onEditEntry/onDeleteEntry for a logged entry row', async () => {
    const onEditEntry = vi.fn()
    const onDeleteEntry = vi.fn()
    const user = userEvent.setup()
    render(IncomingTable, baseProps({ onEditEntry, onDeleteEntry }))

    await user.click(screen.getAllByRole('button', { name: /^Edit entry from/ })[0]!)
    expect(onEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }))

    await user.click(screen.getAllByRole('button', { name: /^Delete entry from/ })[0]!)
    expect(onDeleteEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }))
  })

  it('renders a greyed placeholder row for an un-logged pay date and accepts it', async () => {
    const onAcceptPlaceholder = vi.fn()
    const user = userEvent.setup()
    render(
      IncomingTable,
      baseProps({
        lines: [makeLine({ key: 'income-2', payDates: ['2026-03-20T00:00:00.000+00:00'] })],
        entries: [],
        onAcceptPlaceholder,
      })
    )

    expect(screen.getByText('Not yet logged')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /^Accept projected pay for/ })[0]!)
    expect(onAcceptPlaceholder).toHaveBeenCalledOnce()
  })

  it('calls onEditPlaceholder for an un-logged pay date', async () => {
    const onEditPlaceholder = vi.fn()
    const user = userEvent.setup()
    render(
      IncomingTable,
      baseProps({
        lines: [makeLine({ key: 'income-2', payDates: ['2026-03-20T00:00:00.000+00:00'] })],
        entries: [],
        onEditPlaceholder,
      })
    )

    await user.click(screen.getAllByRole('button', { name: /^Edit projected pay for/ })[0]!)
    expect(onEditPlaceholder).toHaveBeenCalledOnce()
  })
})
