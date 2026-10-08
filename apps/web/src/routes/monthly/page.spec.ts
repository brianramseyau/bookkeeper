import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'svelte-sonner'
import { confirmDestructive } from '$lib/components/app/confirmDestructive.svelte'
import { page } from '$app/state'
import { getStandardMonth, type StandardMonthResult } from '$lib/api/standard-month'
import { setMonthCarryover } from '$lib/api/month-carryover'
import {
  createIncomeEntry,
  deleteIncomeEntry,
  listIncomeEntries,
  listIncomeSources,
  updateIncomeEntry,
  type IncomeEntry,
  type IncomeSource,
} from '$lib/api/income'
import { upsertUtilityBill } from '$lib/api/utilities'
import {
  createExpenseActual,
  deleteExpenseActual,
  listExpenseActuals,
  updateExpenseActual,
  type ExpenseMonthlyActual,
} from '$lib/api/expense-actuals'
import { upsertRecurringBillPayment } from '$lib/api/recurring-bills'
import { upsertSubscriptionPayment } from '$lib/api/subscriptions'
import { upsertExpensePayment } from '$lib/api/expenses'
import { listUsers, type UserSummary } from '$lib/api/users'
import { ApiError } from '$lib/api'
import { monthState } from '$lib/stores/month.svelte'
import MonthPage from './+page.svelte'

vi.mock('$app/navigation', () => ({}))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/monthly') } }))
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('$lib/components/app/confirmDestructive.svelte', () => ({
  confirmDestructive: vi.fn(),
}))
vi.mock('$lib/api/standard-month', () => ({ getStandardMonth: vi.fn() }))
vi.mock('$lib/api/month-carryover', () => ({ setMonthCarryover: vi.fn() }))
vi.mock('$lib/api/income', () => ({
  listIncomeSources: vi.fn(),
  listIncomeEntries: vi.fn(),
  createIncomeEntry: vi.fn(),
  updateIncomeEntry: vi.fn(),
  deleteIncomeEntry: vi.fn(),
}))
vi.mock('$lib/api/utilities', () => ({ upsertUtilityBill: vi.fn() }))
vi.mock('$lib/api/expense-actuals', () => ({
  listExpenseActuals: vi.fn(),
  createExpenseActual: vi.fn(),
  updateExpenseActual: vi.fn(),
  deleteExpenseActual: vi.fn(),
}))
vi.mock('$lib/api/recurring-bills', () => ({ upsertRecurringBillPayment: vi.fn() }))
vi.mock('$lib/api/subscriptions', () => ({ upsertSubscriptionPayment: vi.fn() }))
vi.mock('$lib/api/expenses', () => ({ upsertExpensePayment: vi.fn() }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn() }))

// SvelteKit's real `Page.url` type brands `pathname` with a union of the
// app's known routes - the mock above is a plain URL, so route it through a
// cast here rather than fighting that type at every call site below.
function setPageUrl(url: string) {
  page.url = new URL(url) as unknown as typeof page.url
}

function monthHeading(label: string) {
  return screen.findByRole('heading', { name: label })
}

// The Sheet/Drawer a form opens into is portalled onto `document.body`.
function openSheet() {
  return screen.getByRole('dialog', { hidden: true })
}

const brian: UserSummary = {
  id: 1,
  fullName: 'Brian',
  email: 'brian@example.com',
  displayColor: null,
  initials: 'B',
}

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

const bonusEntry: IncomeEntry = {
  id: 11,
  incomeSourceId: null,
  userId: 1,
  year: 2026,
  month: 3,
  receivedOn: null,
  amount: 250,
  note: 'Bonus',
  taxWithheld: true,
}

function baseData(overrides: Partial<StandardMonthResult> = {}): StandardMonthResult {
  return {
    year: 2026,
    month: 3,
    carryover: 500,
    income: {
      lines: [
        {
          key: 'income-1',
          label: 'Brian Income',
          sourceId: 1,
          userId: 1,
          projected: 5000,
          actual: 5000,
          estimated: false,
          payDates: ['2026-03-14T00:00:00.000+00:00'],
        },
      ],
      projectedTotal: 5000,
      actualTotal: 5000,
    },
    expenses: {
      lines: [
        {
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
        },
        {
          key: 'expense-1',
          label: 'Groceries',
          projected: 600,
          actual: 620,
          dueDay: 5,
          dueDate: null,
          dueDateEstimated: false,
          estimated: false,
          paid: true,
          editable: true,
          receivedOn: null,
        },
      ],
      projectedTotal: 700,
      actualTotal: 730,
    },
    projectedNet: 4300,
    actualNet: 4270,
    ...overrides,
  }
}

// Groceries (expense-1) is paid in the base fixture, which now hides its
// edit pencil (paid lines are locked down) - the expense-actuals tests
// below aren't testing paid status, so they need it unpaid to reach the
// edit sheet at all.
function baseDataWithUnpaidGroceries(): StandardMonthResult {
  const data = baseData()
  return {
    ...data,
    expenses: {
      ...data.expenses,
      lines: data.expenses.lines.map((line) =>
        line.key === 'expense-1' ? { ...line, paid: false } : line
      ),
    },
  }
}

function setDefaultMocks() {
  vi.mocked(getStandardMonth).mockResolvedValue(baseData())
  vi.mocked(listIncomeSources).mockResolvedValue([brianSalary])
  vi.mocked(listIncomeEntries).mockResolvedValue([salaryEntry])
  vi.mocked(listUsers).mockResolvedValue([brian])
}

describe('month page', () => {
  beforeEach(() => {
    // Fixes "now" so the Due column's relative labels (formatRelativeDate)
    // are deterministic regardless of when the suite actually runs - the
    // fixture due dates below are all in March 2026.
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    setPageUrl('http://localhost/monthly?year=2026&month=3')
    // The shared month carries across page mounts within a session, so reset
    // it per test rather than letting one test's navigation leak into the next.
    monthState.year = 2026
    monthState.month = 3
    vi.mocked(getStandardMonth).mockReset()
    vi.mocked(listIncomeSources).mockReset()
    vi.mocked(listIncomeEntries).mockReset()
    vi.mocked(listUsers).mockReset()
    vi.mocked(setMonthCarryover).mockReset()
    vi.mocked(createIncomeEntry).mockReset()
    vi.mocked(updateIncomeEntry).mockReset()
    vi.mocked(deleteIncomeEntry).mockReset()
    vi.mocked(upsertUtilityBill).mockReset()
    vi.mocked(listExpenseActuals).mockReset()
    vi.mocked(createExpenseActual).mockReset()
    vi.mocked(updateExpenseActual).mockReset()
    vi.mocked(deleteExpenseActual).mockReset()
    vi.mocked(upsertRecurringBillPayment).mockReset()
    vi.mocked(upsertSubscriptionPayment).mockReset()
    vi.mocked(upsertExpensePayment).mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(confirmDestructive).mockReset()
    vi.mocked(confirmDestructive).mockResolvedValue(true)
  })

  it('reads year/month from the URL and shows a loading state, then the header', async () => {
    setPageUrl('http://localhost/monthly?year=2025&month=11')
    setDefaultMocks()
    render(MonthPage)

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(monthState.year).toBe(2025)
    expect(monthState.month).toBe(11)
    expect(getStandardMonth).toHaveBeenCalledWith(2025, 11)
    expect(await monthHeading('November 2025')).toBeInTheDocument()
  })

  it('defaults to the current month when the URL has no valid params', async () => {
    setPageUrl('http://localhost/monthly')
    setDefaultMocks()
    const now = new Date()
    render(MonthPage)

    expect(getStandardMonth).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1)
  })

  it('re-fetches when the shared month changes', async () => {
    setDefaultMocks()
    render(MonthPage)
    await monthHeading('March 2026')

    // The picker's own state is shared, so stepping it (here simulated by
    // mutating the store) makes this page re-fetch.
    monthState.month = 2

    await waitFor(() => expect(getStandardMonth).toHaveBeenLastCalledWith(2026, 2))
  })

  it('ignores a stale response when the month changes mid-flight', async () => {
    // February's request is left pending, then resolved only after the month
    // has moved on to March - its response must be dropped rather than shown
    // under March's heading.
    let resolveFebruary: (value: StandardMonthResult) => void = () => {}
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockImplementation((_y, m) =>
      m === 2
        ? new Promise<StandardMonthResult>((resolve) => (resolveFebruary = resolve))
        : Promise.resolve(baseData())
    )
    render(MonthPage)
    await monthHeading('March 2026')

    monthState.month = 2
    await waitFor(() => expect(getStandardMonth).toHaveBeenLastCalledWith(2026, 2))
    monthState.month = 3
    await waitFor(() => expect(getStandardMonth).toHaveBeenLastCalledWith(2026, 3))

    // The stale February response now lands; flush its continuation before
    // asserting, so a missing guard (which would swap in $999) is caught.
    resolveFebruary(baseData({ income: { ...baseData().income, actualTotal: 999 } }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText('$999.00')).toBeNull()
    expect(screen.getAllByText('$5,000.00').length).toBeGreaterThan(0)
  })

  it('shows an API error message on failure', async () => {
    vi.mocked(getStandardMonth).mockRejectedValue(new ApiError(500, 'Could not load month'))
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)
    expect(await screen.findByText('Could not load month')).toBeInTheDocument()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(getStandardMonth).mockRejectedValue(new Error('boom'))
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)
    expect(await screen.findByText('Failed to load monthly view')).toBeInTheDocument()
  })

  it('shows the Income/Outgoing/Net stat strip and the carried-over balance', async () => {
    setDefaultMocks()
    render(MonthPage)

    // Carried over, shown in the compact CarryoverCard header row.
    expect(await screen.findByText('$500.00')).toBeInTheDocument()
    const incomeCell = screen.getByText('Income').parentElement!
    expect(within(incomeCell).getByText('$5,000.00')).toBeInTheDocument()
    expect(screen.getByText('Outgoing')).toBeInTheDocument()
    expect(screen.getByText('$730.00')).toBeInTheDocument()
    const net = screen.getByText('+$4,270.00')
    expect(net.className).toContain('text-in')
  })

  it('edits and saves the carried-over balance', async () => {
    setDefaultMocks()
    vi.mocked(setMonthCarryover).mockResolvedValue({
      id: 1,
      year: 2026,
      month: 3,
      amount: 750,
      notes: null,
    })
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit carried over balance' }))
    const input = screen.getByDisplayValue('500')
    await user.clear(input)
    await user.type(input, '750')
    await user.click(screen.getByRole('button', { name: 'Save carried over balance' }))

    await waitFor(() => expect(setMonthCarryover).toHaveBeenCalledWith(2026, 3, 750))
    expect(getStandardMonth).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledWith('Carried-over balance saved')
  })

  it('still toasts a carryover save when the month changes mid-save', async () => {
    setDefaultMocks()
    let resolveSave: (value: {
      id: number
      year: number
      month: number
      amount: number
      notes: null
    }) => void = () => {}
    vi.mocked(setMonthCarryover).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve
        })
    )
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit carried over balance' }))
    await user.click(screen.getByRole('button', { name: 'Save carried over balance' }))
    await waitFor(() => expect(setMonthCarryover).toHaveBeenCalled())

    // The picker moves on before the save resolves; the toast still fires and
    // the partial refresh is skipped (no second getStandardMonth for March).
    monthState.month = 2
    resolveSave({ id: 1, year: 2026, month: 3, amount: 750, notes: null })

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Carried-over balance saved'))
  })

  it('cancels editing the carried-over balance', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit carried over balance' }))
    await user.click(screen.getByRole('button', { name: 'Cancel editing carried over balance' }))

    expect(screen.queryByDisplayValue('500')).toBeNull()
    expect(setMonthCarryover).not.toHaveBeenCalled()
  })

  it('shows an error when saving the carryover fails', async () => {
    setDefaultMocks()
    vi.mocked(setMonthCarryover).mockRejectedValue(new ApiError(500, 'Could not save carryover'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit carried over balance' }))
    await user.click(screen.getByRole('button', { name: 'Save carried over balance' }))

    expect(await screen.findByText('Could not save carryover')).toBeInTheDocument()
  })

  it('re-fetches as the shared month steps across a year boundary', async () => {
    setDefaultMocks()
    render(MonthPage)
    await monthHeading('March 2026')

    // The picker's own state is shared, so step it (here simulated by
    // mutating the store) rather than clicking its chevrons -
    // MonthNavHeader's own spec covers the click wiring.
    monthState.year = 2025
    monthState.month = 12
    await waitFor(() => expect(getStandardMonth).toHaveBeenLastCalledWith(2025, 12))

    monthState.year = 2027
    monthState.month = 1
    await waitFor(() => expect(getStandardMonth).toHaveBeenLastCalledWith(2027, 1))
  })

  it('jumps back to the current month', async () => {
    setPageUrl('http://localhost/monthly?year=2020&month=1')
    setDefaultMocks()
    render(MonthPage)
    await waitFor(() => expect(getStandardMonth).toHaveBeenCalledWith(2020, 1))

    const now = new Date()
    monthState.goToCurrentMonth()

    await waitFor(() =>
      expect(getStandardMonth).toHaveBeenLastCalledWith(now.getFullYear(), now.getMonth() + 1)
    )
  })

  it('shows the source label and pay date only once for a matched income entry', async () => {
    setDefaultMocks()
    render(MonthPage)
    expect(await screen.findByText('Brian Income')).toBeInTheDocument()
    // The source's single pay date positionally matches the one logged
    // entry, so it renders as a single real row - no separate placeholder
    // row duplicating the date.
    expect(screen.getAllByText('14 Mar 2026').length).toBe(1)
  })

  it('renders an italic placeholder row for each pay date with no matching entry yet', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        income: {
          lines: [
            {
              key: 'income-2',
              label: 'Ariel Income',
              sourceId: 2,
              userId: null,
              projected: 2600,
              actual: 2600,
              estimated: false,
              payDates: [
                '2026-03-04T00:00:00.000+00:00',
                '2026-03-18T00:00:00.000+00:00',
                '2026-04-01T00:00:00.000+00:00',
              ],
            },
          ],
          projectedTotal: 2600,
          actualTotal: 2600,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    expect(await screen.findByText('4 Mar 2026')).toBeInTheDocument()
    expect(screen.getByText('18 Mar 2026')).toBeInTheDocument()
    expect(screen.getByText('1 Apr 2026')).toBeInTheDocument()
    // 2600 / 3 pay dates = 866.67 projected per placeholder row.
    expect(screen.getAllByText('$866.67')).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /^Accept projected pay for/ })).toHaveLength(3)
  })

  it('one-click accepts a placeholder pay date, logging it at the projected amount', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        income: {
          lines: [
            {
              key: 'income-1',
              label: 'Brian Income',
              sourceId: 1,
              userId: 1,
              projected: 5000,
              actual: 0,
              estimated: false,
              payDates: ['2026-03-14T00:00:00.000+00:00'],
            },
          ],
          projectedTotal: 5000,
          actualTotal: 0,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([brianSalary])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([brian])
    vi.mocked(createIncomeEntry).mockResolvedValue(salaryEntry)
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(
      await screen.findByRole('button', { name: 'Accept projected pay for 14 Mar 2026' })
    )

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        incomeSourceId: 1,
        year: 2026,
        month: 3,
        amount: 5000,
        receivedOn: '2026-03-14',
      })
    )
  })

  it('edits a placeholder pay date before saving it as a real entry', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        income: {
          lines: [
            {
              key: 'income-1',
              label: 'Brian Income',
              sourceId: 1,
              userId: 1,
              projected: 5000,
              actual: 0,
              estimated: false,
              payDates: ['2026-03-14T00:00:00.000+00:00'],
            },
          ],
          projectedTotal: 5000,
          actualTotal: 0,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([brianSalary])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([brian])
    vi.mocked(createIncomeEntry).mockResolvedValue(salaryEntry)
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(
      await screen.findByRole('button', { name: 'Edit projected pay for 14 Mar 2026' })
    )
    // fireEvent rather than userEvent for interactions inside the sheet - a
    // real pointerdown on Drawer content hits vaul-svelte's drag-to-dismiss
    // handler, which needs setPointerCapture (unimplemented in jsdom).
    const amountInput = screen.getByDisplayValue('5000')
    await fireEvent.input(amountInput, { target: { value: '5100' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        incomeSourceId: 1,
        year: 2026,
        month: 3,
        amount: 5100,
        receivedOn: '2026-03-14',
        note: null,
      })
    )
  })

  it('shows nothing in the list for an income line with no pay dates and no logged entries', async () => {
    // The unified list only ever renders incomeRowsForLine's rows (actual/
    // placeholder, see monthly-unified-list.ts) - a line with neither has
    // nothing dated to place in the chronological list, even though its own
    // projected/actual totals still count toward data.income.actualTotal.
    // This is a deliberate scope decision (PLAN_02_PHASE_01), not a bug.
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        income: {
          lines: [
            {
              key: 'income-1',
              label: 'Brian Income',
              sourceId: 1,
              userId: 1,
              projected: 5000,
              actual: 5000,
              estimated: true,
              payDates: [],
            },
          ],
          projectedTotal: 5000,
          actualTotal: 5000,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([brianSalary])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([brian])
    render(MonthPage)

    await monthHeading('March 2026')
    expect(screen.queryByText('Brian Income')).toBeNull()
  })

  it('does not show edit/delete actions for a logged income entry', async () => {
    setDefaultMocks()
    render(MonthPage)

    await screen.findByText('March pay')
    expect(screen.queryByRole('button', { name: 'Edit entry from 14 Mar 2026' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete entry from 14 Mar 2026' })).toBeNull()
  })

  it('requires an amount to log income', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Log income' }))
    const sheet = openSheet()
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log income' }))

    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
    expect(createIncomeEntry).not.toHaveBeenCalled()
  })

  it('logs a new income entry and reloads', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockResolvedValue(salaryEntry)
    const user = userEvent.setup()
    render(MonthPage)
    await monthHeading('March 2026')

    await user.click(screen.getByRole('button', { name: 'Log income' }))
    const sheet = openSheet()
    await fireEvent.change(within(sheet).getByLabelText('Person'), { target: { value: '1' } })
    await fireEvent.change(within(sheet).getByLabelText('Source'), { target: { value: '1' } })
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '100' } })
    await fireEvent.input(within(sheet).getByLabelText('Note'), { target: { value: 'extra' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log income' }))

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        incomeSourceId: 1,
        userId: null,
        year: 2026,
        month: 3,
        amount: 100,
        receivedOn: null,
        note: 'extra',
        taxWithheld: null,
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Income entry added')
  })

  it('requires a person when logging unattributed income', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Log income' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '100' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log income' }))

    expect(await screen.findByText('A person is required for other income')).toBeInTheDocument()
    expect(createIncomeEntry).not.toHaveBeenCalled()
  })

  it('logs an unattributed income entry for a person, with tax withheld', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockResolvedValue({
      ...salaryEntry,
      incomeSourceId: null,
      userId: 1,
      taxWithheld: true,
    })
    const user = userEvent.setup()
    render(MonthPage)
    await monthHeading('March 2026')

    await user.click(screen.getByRole('button', { name: 'Log income' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '250' } })
    await fireEvent.change(within(sheet).getByLabelText('Person'), { target: { value: '1' } })
    await fireEvent.click(within(sheet).getByLabelText('Tax withheld'))
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log income' }))

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        incomeSourceId: null,
        userId: 1,
        year: 2026,
        month: 3,
        amount: 250,
        receivedOn: null,
        note: null,
        taxWithheld: true,
      })
    )
  })

  it('shows an API error when logging income fails', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockRejectedValue(new ApiError(422, 'Could not log income'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Log income' }))
    const sheet = openSheet()
    await fireEvent.input(within(sheet).getByLabelText('Amount'), { target: { value: '100' } })
    await fireEvent.change(within(sheet).getByLabelText('Person'), { target: { value: '1' } })
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Log income' }))

    expect(await screen.findByText('Could not log income')).toBeInTheDocument()
  })

  it('shows the person for an unattributed income entry', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        income: {
          lines: [
            {
              key: 'income-unattributed-1',
              label: 'Other income',
              sourceId: null,
              userId: 1,
              projected: 0,
              actual: 250,
              estimated: false,
              payDates: [],
            },
          ],
          projectedTotal: 0,
          actualTotal: 250,
        },
      })
    )
    vi.mocked(listIncomeEntries).mockResolvedValue([bonusEntry])
    render(MonthPage)

    expect(await screen.findByText('Other income')).toBeInTheDocument()
    expect(screen.getByText(/Brian/)).toBeInTheDocument()
  })

  it('does not show an edit action for an unattributed income entry', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        income: {
          lines: [
            {
              key: 'income-unattributed-1',
              label: 'Other income',
              sourceId: null,
              userId: 1,
              projected: 0,
              actual: 250,
              estimated: false,
              payDates: [],
            },
          ],
          projectedTotal: 0,
          actualTotal: 250,
        },
      })
    )
    vi.mocked(listIncomeEntries).mockResolvedValue([bonusEntry])
    render(MonthPage)

    await screen.findByText('Other income')
    expect(screen.queryByRole('button', { name: 'Edit entry' })).toBeNull()
  })

  it('shows due dates relative to today, sorted soonest-first, colored by paid rather than actual', async () => {
    // "now" is pinned to 2026-03-15 in beforeEach. Electricity's dueDate is
    // 2026-03-20 (5 days out, unpaid - amber); Groceries' dueDay of 5
    // resolves against the viewed month (March 2026) to 2026-03-05, which is
    // in the past so it renders as the actual date rather than "N days ago",
    // and is marked paid - green despite being overdue, since `paid` (not
    // `actual`) is what decides the color now. Groceries should sort ahead
    // of Electricity in the unified list.
    setDefaultMocks()
    render(MonthPage)

    const paidChip = await screen.findByText('5 Mar 2026')
    expect(paidChip.className).toContain('bg-in-tint')

    const dueSoonChip = screen.getByText('In 5 days')
    expect(dueSoonChip.className).toContain('bg-due-tint')

    const rows = (await screen.findAllByRole('listitem')).filter(
      (li) => li.textContent?.includes('Groceries') || li.textContent?.includes('Electricity')
    )
    expect(rows[0]!.textContent).toContain('Groceries')
    expect(rows[1]!.textContent).toContain('Electricity')
  })

  it('shows a red chip for an overdue line with no actual recorded yet', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'recurring-bill-1',
              label: 'Kayo',
              projected: 45.99,
              actual: null,
              dueDay: 5,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 45.99,
          actualTotal: 0,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    const chip = await screen.findByText('5 Mar 2026')
    expect(chip.className).toContain('bg-over-tint')
  })

  it('shows an amber chip for a line due soon with no actual recorded yet', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'recurring-bill-2',
              label: 'Kayo',
              projected: 45.99,
              actual: null,
              dueDay: 20,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 45.99,
          actualTotal: 0,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    const chip = await screen.findByText('In 5 days')
    expect(chip.className).toContain('bg-due-tint')
  })

  it('shows a due date more than 30 days out as plain text, with no chip, while still unrecorded', async () => {
    // A utility's dueDate is hidden outright once actual is null (see the
    // "predicted billing month" test below), so the only way a due date can
    // still be >30 days out AND unrecorded is a dueDay-based line viewed
    // from far enough in the past - push "now" back to 2026-02-01 so
    // Groceries' dueDay of 5 (2026-03-05) is 32 days out.
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'))
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'recurring-bill-3',
              label: 'Kayo',
              projected: 45.99,
              actual: null,
              dueDay: 5,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 45.99,
          actualTotal: 0,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    const dueText = await screen.findByText('In 32 days')
    expect(dueText.closest('p')!.getAttribute('title')).toBe('5 Mar 2026')
  })

  it('shows a utility due date flagged "(est.)" when this month is only a predicted billing month with no actual entered yet', async () => {
    // A quarterly utility (e.g. Water) gets a predicted dueDate as soon as
    // the viewed month is cued up as its next billing month, even before
    // that quarter's bill has actually been entered - `dueDateEstimated`
    // flags it as a guess (averaged from past received dates) rather than
    // a confirmed date, so it's shown as plain text with an "(est.)" tag
    // instead of the colored due-soon chip, and can't be marked paid.
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'utility-3',
              label: 'Water',
              projected: 120,
              actual: null,
              dueDay: null,
              dueDate: '2026-03-28T00:00:00.000+00:00',
              dueDateEstimated: true,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 120,
          actualTotal: 0,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    await screen.findByText('Water')
    const row = screen.getByText('Water').closest('li')!
    expect(within(row).getByText('In 13 days')).toBeInTheDocument()
    expect(within(row).getByText('(est.)')).toBeInTheDocument()
    expect(row.querySelector('.rounded-full')).toBeNull()

    const paidCheckbox = within(row).getByLabelText(/^Paid/)
    expect(paidCheckbox).toBeDisabled()
  })

  it('falls back to plain text with no due chip when a line has no due date at all', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'subscription-1',
              label: 'Netflix (Brian)',
              projected: 40,
              actual: 40,
              dueDay: null,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 40,
          actualTotal: 40,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    const row = (await screen.findByText('Netflix (Brian)')).closest('li')!
    expect(row.querySelector('.rounded-full')).toBeNull()
    expect(within(row).getByText('—')).toBeInTheDocument()
  })

  it('shows a Paid checkbox, checked per line, only enabled for lines with a resolved due date', async () => {
    // Groceries is marked paid in the base fixture, Electricity isn't - and
    // sorts second (due later), so checkboxes[0] is Groceries' and
    // checkboxes[1] is Electricity's.
    setDefaultMocks()
    render(MonthPage)

    const checkboxes = await screen.findAllByRole('checkbox', { name: /^Paid/ })
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[0]).toBeEnabled()
    expect(checkboxes[1]).not.toBeChecked()
    expect(checkboxes[1]).toBeEnabled()
  })

  it('shows a disabled, tooltipped Paid checkbox for a line with no due date and no known actual', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'expense-1',
              label: 'Groceries',
              projected: 300,
              actual: null,
              dueDay: null,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
            {
              key: 'recurring-bills-avg',
              label: 'Recurring Bills (avg)',
              projected: 5.42,
              actual: null,
              dueDay: null,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 305.42,
          actualTotal: 0,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    await screen.findByText('Groceries')
    const checkboxes = await screen.findAllByRole('checkbox', { name: /^Paid/ })
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toBeDisabled()
    expect(checkboxes[0]).toHaveAttribute(
      'title',
      'No actual amount logged for this expense this month'
    )
    expect(checkboxes[1]).toBeDisabled()
    expect(checkboxes[1]).toHaveAttribute('title', 'No actual amount recorded for this month yet')
  })

  it('shows a Paid checkbox for an expense line once it has a known actual, even with no due date', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'expense-1',
              label: 'Groceries',
              projected: 300,
              actual: 300,
              dueDay: null,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 300,
          actualTotal: 300,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    const checkbox = await screen.findByRole('checkbox', { name: /^Paid/ })
    expect(checkbox).not.toBeChecked()
  })

  it('ticking Paid on an expense line calls upsertExpensePayment', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'expense-1',
              label: 'Groceries',
              projected: 300,
              actual: 300,
              dueDay: null,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 300,
          actualTotal: 300,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    vi.mocked(upsertExpensePayment).mockResolvedValue({
      id: 1,
      expenseId: 1,
      year: 2026,
      month: 3,
      paid: true,
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    const checkbox = await screen.findByRole('checkbox', { name: /^Paid/ })
    await user.click(checkbox)

    await waitFor(() => expect(upsertExpensePayment).toHaveBeenCalledWith(1, 2026, 3, true))
  })

  it('ticking Paid on a utility line resends its known amount alongside paid', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockResolvedValue({
      id: 1,
      utilityId: 1,
      year: 2026,
      month: 3,
      amount: 110,
      notes: null,
      paid: true,
      receivedOn: null,
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    // Groceries (paid) sorts first, Electricity (unpaid, the utility line) second.
    const checkboxes = await screen.findAllByRole('checkbox', { name: /^Paid/ })
    await user.click(checkboxes[1]!)

    await waitFor(() => expect(upsertUtilityBill).toHaveBeenCalledWith(1, 2026, 3, 110, true))
    await waitFor(() => expect(getStandardMonth).toHaveBeenCalledTimes(2))
  })

  it('ticking Paid on a recurring bill line calls upsertRecurringBillPayment', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'recurring-bill-7',
              label: 'Kayo',
              projected: 45.99,
              actual: 45.99,
              dueDay: 20,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 45.99,
          actualTotal: 45.99,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    vi.mocked(upsertRecurringBillPayment).mockResolvedValue({
      id: 1,
      recurringBillId: 7,
      year: 2026,
      month: 3,
      paid: true,
      amount: null,
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    const checkbox = await screen.findByRole('checkbox', { name: /^Paid/ })
    await user.click(checkbox)

    await waitFor(() => expect(upsertRecurringBillPayment).toHaveBeenCalledWith(7, 2026, 3, true))
  })

  it('ticking Paid on a subscription line calls upsertSubscriptionPayment', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'subscription-9',
              label: 'Netflix (Brian)',
              projected: 22.99,
              actual: 22.99,
              dueDay: 10,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 22.99,
          actualTotal: 22.99,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    vi.mocked(upsertSubscriptionPayment).mockResolvedValue({
      id: 1,
      userSubscriptionId: 9,
      year: 2026,
      month: 3,
      paid: true,
      amount: null,
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    const checkbox = await screen.findByRole('checkbox', { name: /^Paid/ })
    await user.click(checkbox)

    await waitFor(() => expect(upsertSubscriptionPayment).toHaveBeenCalledWith(9, 2026, 3, true))
  })

  it('edits a subscription line amount', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'subscription-9',
              label: 'Netflix (Brian)',
              projected: 22.99,
              actual: 22.99,
              dueDay: 10,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 22.99,
          actualTotal: 22.99,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    vi.mocked(upsertSubscriptionPayment).mockResolvedValue({
      id: 1,
      userSubscriptionId: 9,
      year: 2026,
      month: 3,
      paid: false,
      amount: 24.99,
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Netflix (Brian)' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.input(within(dialog).getByLabelText('Amount'), { target: { value: '24.99' } })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(upsertSubscriptionPayment).toHaveBeenCalledWith(9, 2026, 3, undefined, 24.99)
    )
  })

  it('flags an estimated line clearly as assumed, both on its actual amount and its paid checkbox', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'subscription-9',
              label: 'Netflix (Brian)',
              projected: 22.99,
              actual: 22.99,
              dueDay: 10,
              dueDate: null,
              dueDateEstimated: false,
              estimated: true,
              paid: true,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 22.99,
          actualTotal: 22.99,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    const checkbox = await screen.findByRole('checkbox', { name: /^Paid/ })
    expect(checkbox).toHaveClass('accent-due')
    expect(checkbox).toHaveAttribute(
      'title',
      "No record for this month this far back - assumed paid at today's amount because it's in the past. Confirm or correct it."
    )
    expect(
      screen.getByRole('button', {
        name: "Why is Netflix (Brian)'s actual amount estimated?",
      })
    ).toBeInTheDocument()
  })

  it('does not flag a normally-tracked line as assumed', async () => {
    setDefaultMocks()
    render(MonthPage)

    const checkbox = await screen.findAllByRole('checkbox', { name: /^Paid/ })
    for (const box of checkbox) {
      expect(box).not.toHaveClass('accent-due')
    }
    expect(screen.queryByText(/Why is .* estimated\?/)).toBeNull()
  })

  it('shows an error when toggling paid fails', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockRejectedValue(
      new ApiError(500, 'Could not update paid status')
    )
    const user = userEvent.setup()
    render(MonthPage)

    const checkboxes = await screen.findAllByRole('checkbox', { name: /^Paid/ })
    await user.click(checkboxes[1]!)

    expect(await screen.findByText('Could not update paid status')).toBeInTheDocument()
  })

  it('edits a utility expense line', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockResolvedValue({
      id: 1,
      utilityId: 1,
      year: 2026,
      month: 3,
      amount: 120,
      notes: null,
      paid: false,
      receivedOn: null,
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Electricity' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.input(within(dialog).getByLabelText('Amount'), { target: { value: '120' } })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(upsertUtilityBill).toHaveBeenCalledWith(1, 2026, 3, 120, undefined, null)
    )
  })

  it('edits a utility expense line received date', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
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
              receivedOn: '2026-03-14',
            },
          ],
          projectedTotal: 100,
          actualTotal: 110,
        },
      })
    )
    vi.mocked(upsertUtilityBill).mockResolvedValue({
      id: 1,
      utilityId: 1,
      year: 2026,
      month: 3,
      amount: 110,
      notes: null,
      paid: false,
      receivedOn: '2026-03-21',
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Electricity' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.input(within(dialog).getByLabelText('Received on'), {
      target: { value: '2026-03-21' },
    })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(upsertUtilityBill).toHaveBeenCalledWith(1, 2026, 3, 110, undefined, '2026-03-21')
    )
  })

  it('adds an expense actual when none is logged yet', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(baseDataWithUnpaidGroceries())
    vi.mocked(listExpenseActuals).mockResolvedValue([])
    vi.mocked(createExpenseActual).mockResolvedValue({} as ExpenseMonthlyActual)
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.input(within(dialog).getByLabelText('Amount'), { target: { value: '650' } })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Add entry' }))

    await waitFor(() =>
      expect(createExpenseActual).toHaveBeenCalledWith(1, {
        occurredOn: '2026-03-31',
        amount: 650,
      })
    )
  })

  it('edits and removes a single existing expense actual', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(baseDataWithUnpaidGroceries())
    vi.mocked(listExpenseActuals).mockResolvedValue([
      {
        id: 5,
        expenseId: 1,
        occurredOn: '2026-03-10',
        amount: 620,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    vi.mocked(updateExpenseActual).mockResolvedValue({} as ExpenseMonthlyActual)
    vi.mocked(deleteExpenseActual).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    let dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(updateExpenseActual).toHaveBeenCalledWith(5, { amount: 620 }))

    // fireEvent - the row can sit under the closing sheet's pointer-events:
    // none overlay for a tick, which userEvent's pointer simulation rejects.
    await fireEvent.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete entry' }))
    await waitFor(() => expect(deleteExpenseActual).toHaveBeenCalledWith(5))
  })

  it('skips the partial refresh when an expense save resolves after a month change', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(baseDataWithUnpaidGroceries())
    vi.mocked(listExpenseActuals).mockResolvedValue([
      {
        id: 5,
        expenseId: 1,
        occurredOn: '2026-03-10',
        amount: 620,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    let resolveUpdate: (value: ExpenseMonthlyActual) => void = () => {}
    vi.mocked(updateExpenseActual).mockImplementation(
      () => new Promise((resolve) => (resolveUpdate = resolve))
    )
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(updateExpenseActual).toHaveBeenCalledWith(5, { amount: 620 }))

    // The picker moves to February before the save resolves. The refresh for
    // March must be skipped so it can't overwrite February's data (without its
    // entries); the new month's own load is the last call.
    monthState.month = 2
    resolveUpdate({} as ExpenseMonthlyActual)

    await waitFor(() => expect(getStandardMonth).toHaveBeenLastCalledWith(2026, 2))
    // March was fetched once (the initial load) but not again by the skipped refresh.
    const marchCalls = vi.mocked(getStandardMonth).mock.calls.filter((c) => c[1] === 3).length
    expect(marchCalls).toBe(1)
  })

  it('shows a link to view all entries when an expense has multiple actuals that month', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(baseDataWithUnpaidGroceries())
    vi.mocked(listExpenseActuals).mockResolvedValue([
      {
        id: 5,
        expenseId: 1,
        occurredOn: '2026-03-10',
        amount: 300,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 6,
        expenseId: 1,
        occurredOn: '2026-03-20',
        amount: 320,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const dialog = screen.getByRole('dialog', { hidden: true })

    expect(within(dialog).getByText(/multiple entries for Groceries/i)).toBeInTheDocument()
    const manage = within(dialog).getByRole('link', { name: 'Open Groceries' })
    expect(manage.getAttribute('href')).toBe('/expenses/1')
    expect(within(dialog).queryByRole('button', { name: 'Save changes' })).toBeNull()
  })

  it('cancels editing an expense line', async () => {
    setDefaultMocks()
    vi.mocked(listExpenseActuals).mockResolvedValue([])
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Electricity' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(upsertUtilityBill).not.toHaveBeenCalled()
  })

  it('shows an error when loading actuals for an expense edit fails', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(baseDataWithUnpaidGroceries())
    vi.mocked(listExpenseActuals).mockRejectedValue(new ApiError(500, 'Could not load actuals'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))

    expect(await screen.findByText('Could not load actuals')).toBeInTheDocument()
  })

  it('shows an error when saving an expense edit fails', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockRejectedValue(new ApiError(500, 'Could not save actual'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Electricity' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Could not save actual')).toBeInTheDocument()
  })

  it('shows an error when removing an expense actual fails', async () => {
    setDefaultMocks()
    vi.mocked(getStandardMonth).mockResolvedValue(baseDataWithUnpaidGroceries())
    vi.mocked(listExpenseActuals).mockResolvedValue([
      {
        id: 5,
        expenseId: 1,
        occurredOn: '2026-03-10',
        amount: 620,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    vi.mocked(deleteExpenseActual).mockRejectedValue(new ApiError(500, 'Could not remove actual'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Delete entry' }))

    expect(await screen.findByText('Could not remove actual')).toBeInTheDocument()
  })

  it('does not show an Edit button for a non-editable expense line', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        income: { lines: [], projectedTotal: 0, actualTotal: 0 },
        expenses: {
          lines: [
            {
              key: 'utility-2',
              label: 'Water (shared)',
              projected: 40,
              actual: 40,
              dueDay: null,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: false,
              receivedOn: null,
            },
          ],
          projectedTotal: 40,
          actualTotal: 40,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    expect(await screen.findByText('Water (shared)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Water (shared)' })).toBeNull()
  })

  it('links each expense line label to its corresponding view page', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
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
            },
            {
              key: 'expense-1',
              label: 'Groceries',
              projected: 600,
              actual: 620,
              dueDay: 5,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: true,
              editable: true,
              receivedOn: null,
            },
            {
              key: 'recurring-bill-3',
              label: 'Internet',
              projected: 90,
              actual: 90,
              dueDay: 12,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
            {
              key: 'subscription-4',
              label: 'Netflix (Brian)',
              projected: 20,
              actual: 20,
              dueDay: 8,
              dueDate: null,
              dueDateEstimated: false,
              estimated: false,
              paid: false,
              editable: true,
              receivedOn: null,
            },
          ],
          projectedTotal: 810,
          actualTotal: 840,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    expect((await screen.findByRole('link', { name: 'Electricity' })).getAttribute('href')).toBe(
      '/utilities/1'
    )
    expect(screen.getByRole('link', { name: 'Groceries' }).getAttribute('href')).toBe('/expenses/1')
    expect(screen.getByRole('link', { name: 'Internet' }).getAttribute('href')).toBe('/bills/3')
    expect(screen.getByRole('link', { name: 'Netflix (Brian)' }).getAttribute('href')).toBe(
      '/subscriptions/4'
    )
  })
})
