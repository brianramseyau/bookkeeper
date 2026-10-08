import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncomeEntry } from '$lib/api/income'
import type { StandardMonthIncomeLine, StandardMonthLine } from '$lib/api/standard-month'
import type { UserSummary } from '$lib/api/users'
import { buildUnifiedList } from '$lib/monthly-unified-list'
import MonthlyUnifiedList from './MonthlyUnifiedList.svelte'

function makeExpenseLine(overrides: Partial<StandardMonthLine> = {}): StandardMonthLine {
  return {
    key: 'utility-1',
    label: 'Electricity',
    projected: 100,
    actual: 110,
    dueDay: null,
    dueDate: '2026-03-20T00:00:00.000+00:00',
    dueDateEstimated: false,
    estimated: false,
    paid: false,
    editable: true,
    receivedOn: null,
    ...overrides,
  }
}

function makeIncomeLine(overrides: Partial<StandardMonthIncomeLine> = {}): StandardMonthIncomeLine {
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

function makeEntry(overrides: Partial<IncomeEntry> = {}): IncomeEntry {
  return {
    id: 10,
    incomeSourceId: 1,
    userId: null,
    year: 2026,
    month: 3,
    receivedOn: '2026-03-14T00:00:00.000+00:00',
    amount: 5000,
    note: 'March pay',
    taxWithheld: null,
    ...overrides,
  }
}

const brian: UserSummary = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: null,
  initials: 'B',
}

function baseProps() {
  return {
    year: 2026,
    month: 3,
    users: [brian],
    savingPaidKey: null,
    acceptingPlaceholderKey: null,
    onStartEdit: vi.fn(),
    onTogglePaid: vi.fn(),
    onEditPlaceholder: vi.fn(),
    onAcceptPlaceholder: vi.fn(),
  }
}

describe('MonthlyUnifiedList', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an outgoing line with its due chip, projected figure and actual amount', () => {
    const expenseLine = makeExpenseLine()
    const items = buildUnifiedList([expenseLine], [], [], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items })

    expect(screen.getByText('Electricity')).toBeInTheDocument()
    expect(screen.getByText('$110.00')).toBeInTheDocument()
    expect(screen.getByText('Projected $100.00')).toBeInTheDocument()
    expect(screen.getByText('In 5 days')).toBeInTheDocument()
  })

  it('calls onTogglePaid when the Paid checkbox is toggled', async () => {
    const onTogglePaid = vi.fn()
    const expenseLine = makeExpenseLine({ key: 'expense-1', dueDay: 5, dueDate: null })
    const items = buildUnifiedList([expenseLine], [], [], 2026, 3)
    const user = userEvent.setup()
    render(MonthlyUnifiedList, { ...baseProps(), items, onTogglePaid })

    await user.click(screen.getByRole('checkbox', { name: /^Paid/ }))
    expect(onTogglePaid).toHaveBeenCalledWith(expenseLine, true)
  })

  it('disables every mutation control while the month is stale', () => {
    const expenseLine = makeExpenseLine()
    const placeholder = makeIncomeLine({ payDates: ['2026-03-18T00:00:00.000+00:00'] })
    const items = buildUnifiedList([expenseLine], [placeholder], [], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items, stale: true })

    expect(screen.getByRole('checkbox', { name: /^Paid/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit Electricity' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Accept projected pay for 18 Mar 2026' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Edit projected pay for 18 Mar 2026' })
    ).toBeDisabled()
  })

  it('calls onStartEdit for an editable outgoing line', async () => {
    const onStartEdit = vi.fn()
    const expenseLine = makeExpenseLine()
    const items = buildUnifiedList([expenseLine], [], [], 2026, 3)
    const user = userEvent.setup()
    render(MonthlyUnifiedList, { ...baseProps(), items, onStartEdit })

    await user.click(screen.getByRole('button', { name: 'Edit Electricity' }))
    expect(onStartEdit).toHaveBeenCalledWith(expenseLine)
  })

  it('renders a logged income entry without edit/delete actions', () => {
    const entry = makeEntry()
    const line = makeIncomeLine()
    const items = buildUnifiedList([], [line], [entry], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items })

    expect(screen.getByText('Brian Income')).toBeInTheDocument()
    expect(screen.getByText('$5,000.00')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Edit entry from 14 Mar 2026' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete entry from 14 Mar 2026' })).toBeNull()
  })

  it('shows the owner for an unattributed income entry', () => {
    const entry = makeEntry({ id: 11, incomeSourceId: null, userId: 1, receivedOn: null })
    const line = makeIncomeLine({
      key: 'income-unattributed-1',
      label: 'Other income',
      sourceId: null,
      payDates: [],
    })
    const items = buildUnifiedList([], [line], [entry], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items })

    expect(screen.getByText(/Brian/)).toBeInTheDocument()
  })

  it('renders a placeholder row for an unmatched pay date, italic, with Accept and Edit', async () => {
    const line = makeIncomeLine({ payDates: ['2026-03-18T00:00:00.000+00:00'] })
    const items = buildUnifiedList([], [line], [], 2026, 3)
    const onAcceptPlaceholder = vi.fn()
    const onEditPlaceholder = vi.fn()
    const user = userEvent.setup()
    render(MonthlyUnifiedList, { ...baseProps(), items, onAcceptPlaceholder, onEditPlaceholder })

    expect(screen.getByText('Not yet logged')).toBeInTheDocument()
    const row = screen.getByText('Not yet logged').closest('li')!
    expect(row.className).toContain('italic')

    await user.click(screen.getByRole('button', { name: 'Accept projected pay for 18 Mar 2026' }))
    expect(onAcceptPlaceholder).toHaveBeenCalledWith(
      line,
      expect.objectContaining({ type: 'placeholder', date: '2026-03-18T00:00:00.000+00:00' })
    )

    await user.click(screen.getByRole('button', { name: 'Edit projected pay for 18 Mar 2026' }))
    expect(onEditPlaceholder).toHaveBeenCalledWith(
      line,
      expect.objectContaining({ type: 'placeholder' })
    )
  })

  it('disables the Accept button for the placeholder currently being accepted', () => {
    const line = makeIncomeLine({ payDates: ['2026-03-18T00:00:00.000+00:00'] })
    const items = buildUnifiedList([], [line], [], 2026, 3)
    render(MonthlyUnifiedList, {
      ...baseProps(),
      items,
      acceptingPlaceholderKey: items[0]!.key,
    })

    expect(
      screen.getByRole('button', { name: 'Accept projected pay for 18 Mar 2026' })
    ).toBeDisabled()
  })

  it('does not show an edit pencil for a non-editable outgoing line', () => {
    const expenseLine = makeExpenseLine({ key: 'utility-2', editable: false })
    const items = buildUnifiedList([expenseLine], [], [], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items })

    expect(screen.queryByRole('button', { name: 'Edit Electricity' })).toBeNull()
  })

  it('hides the edit pencil for an outgoing line once marked paid', () => {
    const expenseLine = makeExpenseLine({ paid: true })
    const items = buildUnifiedList([expenseLine], [], [], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items })

    expect(screen.queryByRole('button', { name: 'Edit Electricity' })).toBeNull()
  })

  it('still shows the edit pencil for an assumed-paid (estimated) past-month line', () => {
    // A past month with no payment row defaults `paid` to true so it stops
    // nagging (see standard_month_service.ts), but that's a guess, not a
    // confirmation - `estimated: true` is what actually means "nobody logged
    // this", and it's the only line still missing an actual to log here, so
    // locking the pencil on `paid` alone would remove the only way to log it.
    const expenseLine = makeExpenseLine({ paid: true, estimated: true })
    const items = buildUnifiedList([expenseLine], [], [], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items })

    expect(screen.getByRole('button', { name: 'Edit Electricity' })).toBeInTheDocument()
  })

  it('links an outgoing line label to its detail page', () => {
    const expenseLine = makeExpenseLine()
    const items = buildUnifiedList([expenseLine], [], [], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items })

    expect(screen.getByRole('link', { name: 'Electricity' })).toHaveAttribute(
      'href',
      '/utilities/1'
    )
  })

  it('orders items chronologically with a Today divider between past and future items', () => {
    const pastLine = makeExpenseLine({
      key: 'expense-1',
      label: 'Groceries',
      dueDay: 5,
      dueDate: null,
    })
    const futureLine = makeExpenseLine({ key: 'utility-2', label: 'Gas', dueDate: '2026-03-25' })
    const items = buildUnifiedList([pastLine, futureLine], [], [], 2026, 3)
    render(MonthlyUnifiedList, { ...baseProps(), items })

    const list = screen.getByText('Groceries').closest('ul')!
    const labels = [...list.querySelectorAll('li')].map((li) => li.textContent)
    const groceriesIndex = labels.findIndex((t) => t?.includes('Groceries'))
    const todayIndex = labels.findIndex((t) => t?.includes('Today'))
    const gasIndex = labels.findIndex((t) => t?.includes('Gas'))
    expect(groceriesIndex).toBeLessThan(todayIndex)
    expect(todayIndex).toBeLessThan(gasIndex)
  })
})
