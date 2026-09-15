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
    editingEntryId: null,
    editEntryUserId: '',
    editEntryTaxWithheld: false,
    editEntryAmount: NaN,
    editEntryReceivedOn: '',
    editEntryNote: '',
    savingEntryEdit: false,
    editingPlaceholderKey: null,
    editPlaceholderAmount: NaN,
    editPlaceholderReceivedOn: '',
    editPlaceholderNote: '',
    savingPlaceholderEdit: false,
    acceptingPlaceholderKey: null,
    onStartEditEntry: vi.fn(),
    onCancelEditEntry: vi.fn(),
    onSaveEditEntry: vi.fn(),
    onDeleteEntry: vi.fn(),
    onStartEditPlaceholder: vi.fn(),
    onCancelEditPlaceholder: vi.fn(),
    onSavePlaceholder: vi.fn(),
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

  it('calls onStartEditEntry/onDeleteEntry for a logged entry row', async () => {
    const onStartEditEntry = vi.fn()
    const onDeleteEntry = vi.fn()
    const user = userEvent.setup()
    render(IncomingTable, baseProps({ onStartEditEntry, onDeleteEntry }))

    await user.click(screen.getAllByRole('button', { name: /^Edit entry from/ })[0]!)
    expect(onStartEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }))

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

  it('shows edit inputs and calls onSaveEditEntry/onCancelEditEntry while editing an entry', async () => {
    const onSaveEditEntry = vi.fn()
    const onCancelEditEntry = vi.fn()
    const user = userEvent.setup()
    render(
      IncomingTable,
      baseProps({
        editingEntryId: 10,
        editEntryAmount: 5000,
        onSaveEditEntry,
        onCancelEditEntry,
      })
    )

    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Save income entry' })[0]!)
    expect(onSaveEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }))
    await user.click(screen.getAllByRole('button', { name: 'Cancel editing income entry' })[0]!)
    expect(onCancelEditEntry).toHaveBeenCalledOnce()
  })
})
