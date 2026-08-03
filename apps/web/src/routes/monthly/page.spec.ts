import { render, screen, waitFor, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from '$app/state'
import { replaceState } from '$app/navigation'
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
import MonthPage from './+page.svelte'

vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/monthly') } }))
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
    vi.mocked(replaceState).mockReset()
  })

  it('reads year/month from the URL and shows a loading state, then the header', async () => {
    setDefaultMocks()
    render(MonthPage)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(getStandardMonth).toHaveBeenCalledWith(2026, 3)
    expect(await screen.findByText('March 2026')).toBeInTheDocument()
  })

  it('defaults to the current month when the URL has no valid params', async () => {
    setPageUrl('http://localhost/monthly')
    setDefaultMocks()
    const now = new Date()
    render(MonthPage)

    expect(getStandardMonth).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1)
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

  it('shows the summary tiles with sign-based coloring', async () => {
    setDefaultMocks()
    render(MonthPage)

    expect(await screen.findByText('$500.00')).toBeInTheDocument()
    const projected = screen.getByText('$4,300.00')
    expect(projected.className).toContain('text-emerald-600')
    const actual = screen.getByText('$4,270.00')
    expect(actual.className).toContain('text-emerald-600')
    const variance = screen.getByText('-$30.00')
    expect(variance.className).toContain('text-red-600')
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

  it('navigates to the previous and next month, wrapping the year, and updates URL params', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)
    await screen.findByText('March 2026')

    await user.click(screen.getByRole('button', { name: '← Prev' }))
    expect(await screen.findByText('February 2026')).toBeInTheDocument()
    expect(replaceState).toHaveBeenCalledWith('/monthly?year=2026&month=2', {})
    expect(getStandardMonth).toHaveBeenLastCalledWith(2026, 2)

    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: '← Prev' }))
    }
    await waitFor(() => expect(getStandardMonth).toHaveBeenLastCalledWith(2025, 12))
    expect(await screen.findByText('December 2025')).toBeInTheDocument()

    for (let i = 0; i < 13; i++) {
      await user.click(screen.getByRole('button', { name: 'Next →' }))
    }
    await waitFor(() => expect(getStandardMonth).toHaveBeenLastCalledWith(2027, 1))
  })

  it('jumps back to the current month', async () => {
    setPageUrl('http://localhost/monthly?year=2020&month=1')
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)
    await screen.findByText('January 2020')

    const now = new Date()
    await user.click(screen.getByRole('button', { name: 'This Month' }))

    await waitFor(() =>
      expect(getStandardMonth).toHaveBeenLastCalledWith(now.getFullYear(), now.getMonth() + 1)
    )
  })

  it('resolves the owner name for an income line and shows its pay date only once, not duplicated', async () => {
    setDefaultMocks()
    render(MonthPage)
    expect(await screen.findByText('Brian', { selector: 'td' })).toBeInTheDocument()
    // The source's single pay date positionally matches the one logged
    // entry, so it renders as a single real row - no separate pay-dates
    // subtitle and no placeholder row duplicating the date.
    expect(screen.getAllByText('14 Mar 2026').length).toBe(1)
  })

  it('renders a greyed placeholder row for each pay date with no matching entry yet', async () => {
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
    const amountInput = screen.getByDisplayValue('5000')
    await user.clear(amountInput)
    await user.type(amountInput, '5100')
    await user.click(screen.getByRole('button', { name: 'Save income entry' }))

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

  it('shows the "(est.)" tag for an estimated income actual', async () => {
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

    expect(await screen.findByText('(est.)')).toBeInTheDocument()
  })

  it('edits and deletes a logged income entry', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeEntry).mockResolvedValue(salaryEntry)
    vi.mocked(deleteIncomeEntry).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 14 Mar 2026' }))
    await user.click(screen.getByRole('button', { name: 'Save income entry' }))
    await waitFor(() =>
      expect(updateIncomeEntry).toHaveBeenCalledWith(10, {
        amount: 5000,
        receivedOn: '2026-03-14',
        note: 'March pay',
      })
    )

    await user.click(await screen.findByRole('button', { name: 'Delete entry from 14 Mar 2026' }))
    await waitFor(() => expect(deleteIncomeEntry).toHaveBeenCalledWith(10))
  })

  it('blocks saving an entry edit when the amount field is cleared', async () => {
    // Svelte's number-input binding coerces an emptied field to `null`, not
    // `NaN` - so the guard must check for both to catch a cleared field, not
    // just a never-touched one (see the "requires an amount to log income"
    // test below for that path).
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 14 Mar 2026' }))
    const amountInput = screen.getByDisplayValue('5000')
    await user.clear(amountInput)
    await user.click(screen.getByRole('button', { name: 'Save income entry' }))

    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('shows an API error when saving an entry edit fails', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not save entry'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 14 Mar 2026' }))
    await user.click(screen.getByRole('button', { name: 'Save income entry' }))

    expect(await screen.findByText('Could not save entry')).toBeInTheDocument()
  })

  it('cancels editing an entry', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry from 14 Mar 2026' }))
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel editing income entry' }))

    expect(screen.queryByDisplayValue('5000')).toBeNull()
    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('shows an error when deleting an entry fails', async () => {
    setDefaultMocks()
    vi.mocked(deleteIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not delete entry'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Delete entry from 14 Mar 2026' }))

    expect(await screen.findByText('Could not delete entry')).toBeInTheDocument()
  })

  it('requires an amount to log income', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Log income' }))

    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
    expect(createIncomeEntry).not.toHaveBeenCalled()
  })

  it('logs a new income entry and reloads', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockResolvedValue(salaryEntry)
    const user = userEvent.setup()
    render(MonthPage)
    await screen.findByText('March 2026')

    await user.selectOptions(screen.getByLabelText('Person'), '1')
    await user.selectOptions(screen.getByLabelText('Source'), '1')
    await user.type(screen.getByLabelText('Amount'), '100')
    await user.type(screen.getByLabelText('Note'), 'extra')
    await user.click(screen.getByRole('button', { name: 'Log income' }))

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
  })

  it('requires a person when logging unattributed income', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.type(await screen.findByLabelText('Amount'), '100')
    await user.click(screen.getByRole('button', { name: 'Log income' }))

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
    await screen.findByText('March 2026')

    await user.type(screen.getByLabelText('Amount'), '250')
    await user.selectOptions(screen.getByLabelText('Person'), '1')
    await user.click(screen.getByLabelText('Tax withheld'))
    await user.click(screen.getByRole('button', { name: 'Log income' }))

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

    await user.type(await screen.findByLabelText('Amount'), '100')
    await user.selectOptions(screen.getByLabelText('Person'), '1')
    await user.click(screen.getByRole('button', { name: 'Log income' }))

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

    expect((await screen.findAllByText('Brian', { selector: 'td' })).length).toBeGreaterThan(1)
  })

  it('edits an unattributed income entry, changing its person and tax-withheld flag', async () => {
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
    vi.mocked(updateIncomeEntry).mockResolvedValue(bonusEntry)
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit entry' }))
    await user.click(screen.getByLabelText('Withheld'))
    await user.click(screen.getByRole('button', { name: 'Save income entry' }))

    await waitFor(() =>
      expect(updateIncomeEntry).toHaveBeenCalledWith(11, {
        userId: 1,
        amount: 250,
        receivedOn: null,
        note: 'Bonus',
        taxWithheld: false,
      })
    )
  })

  it('shows due dates relative to today, sorted soonest-first, colored by paid rather than actual', async () => {
    // "now" is pinned to 2026-03-15 in beforeEach. Electricity's dueDate is
    // 2026-03-20 (5 days out, unpaid - amber); Groceries' dueDay of 5
    // resolves against the viewed month (March 2026) to 2026-03-05, which is
    // in the past so it renders as the actual date rather than "N days ago",
    // and is marked paid - green despite being overdue, since `paid` (not
    // `actual`) is what decides the color now. No more "Day 5" wording, and
    // Groceries should sort ahead of Electricity.
    setDefaultMocks()
    render(MonthPage)

    const paidChip = await screen.findByText('5 Mar 2026')
    expect(paidChip.className).toContain('bg-green-100')
    expect(paidChip.closest('td')!.getAttribute('title')).toBe('5 Mar 2026')

    const dueSoonChip = screen.getByText('In 5 days')
    expect(dueSoonChip.className).toContain('bg-amber-100')
    expect(dueSoonChip.closest('td')!.getAttribute('title')).toBe('20 Mar 2026')

    // Expenses table renders first now, so it's tables[0].
    const rows = (await screen.findAllByRole('table'))[0]!.querySelectorAll('tbody tr')
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
    expect(chip.className).toContain('bg-red-100')
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
    expect(chip.className).toContain('bg-amber-100')
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
    expect(dueText.tagName).toBe('TD')
    expect(dueText.getAttribute('title')).toBe('5 Mar 2026')
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

    const dueCell = (await screen.findByText('Water')).closest('tr')!.children[1] as HTMLElement
    expect(dueCell.textContent).toBe('Due In 13 days(est.)')
    expect(dueCell.querySelector('.rounded-full')).toBeNull()
    expect(dueCell.getAttribute('title')).toBe(
      '28 Mar 2026 (estimated from the average received date of past bills)'
    )

    const paidCheckbox = within(dueCell.closest('tr')!).getByLabelText('Paid')
    expect(paidCheckbox).toBeDisabled()
  })

  it('falls back to an em dash with no tooltip when a line has no due date at all', async () => {
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

    const dueCell = (await screen.findByText('Netflix (Brian)')).closest('tr')!
      .children[1] as HTMLElement
    expect(dueCell.textContent).toBe('Due —')
    expect(dueCell.getAttribute('title')).toBeNull()
  })

  it('shows a Paid checkbox, checked per line, only enabled for lines with a resolved due date', async () => {
    // Groceries is marked paid in the base fixture, Electricity isn't - and
    // sorts second (due later), so checkboxes[0] is Groceries' and
    // checkboxes[1] is Electricity's.
    setDefaultMocks()
    render(MonthPage)

    const checkboxes = await screen.findAllByRole('checkbox', { name: 'Paid' })
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
    const checkboxes = await screen.findAllByRole('checkbox', { name: 'Paid' })
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

    const checkbox = await screen.findByRole('checkbox', { name: 'Paid' })
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

    const checkbox = await screen.findByRole('checkbox', { name: 'Paid' })
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
    const checkboxes = await screen.findAllByRole('checkbox', { name: 'Paid' })
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

    const checkbox = await screen.findByRole('checkbox', { name: 'Paid' })
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

    const checkbox = await screen.findByRole('checkbox', { name: 'Paid' })
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
    const amountInput = screen.getByDisplayValue('22.99')
    await user.clear(amountInput)
    await user.type(amountInput, '24.99')
    await user.click(screen.getByRole('button', { name: 'Save Netflix (Brian)' }))

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

    const checkbox = await screen.findByRole('checkbox', { name: 'Paid' })
    expect(checkbox).toHaveClass('text-amber-500')
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

    const checkbox = await screen.findAllByRole('checkbox', { name: 'Paid' })
    for (const box of checkbox) {
      expect(box).not.toHaveClass('text-amber-500')
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

    const checkboxes = await screen.findAllByRole('checkbox', { name: 'Paid' })
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
    const amountInput = screen.getByDisplayValue('110')
    await user.clear(amountInput)
    await user.type(amountInput, '120')
    await user.click(screen.getByRole('button', { name: 'Save Electricity' }))

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
    const receivedInput = screen.getByDisplayValue('2026-03-14')
    await user.clear(receivedInput)
    await user.type(receivedInput, '2026-03-21')
    await user.click(screen.getByRole('button', { name: 'Save Electricity' }))

    await waitFor(() =>
      expect(upsertUtilityBill).toHaveBeenCalledWith(1, 2026, 3, 110, undefined, '2026-03-21')
    )
  })

  it('adds an expense actual when none is logged yet', async () => {
    setDefaultMocks()
    vi.mocked(listExpenseActuals).mockResolvedValue([])
    vi.mocked(createExpenseActual).mockResolvedValue({} as ExpenseMonthlyActual)
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    expect(await screen.findByRole('button', { name: 'Save Groceries' })).toBeInTheDocument()
    // The expense row's amount input is now the first spinbutton on the
    // page (Expenses renders above the Income section's "Log income" form,
    // whose Amount field is the other spinbutton).
    const amountInputs = screen.getAllByRole('spinbutton')
    await user.type(amountInputs[0]!, '650')
    await user.click(screen.getByRole('button', { name: 'Save Groceries' }))

    await waitFor(() =>
      expect(createExpenseActual).toHaveBeenCalledWith(1, {
        occurredOn: '2026-03-31',
        amount: 650,
      })
    )
  })

  it('edits and removes a single existing expense actual', async () => {
    setDefaultMocks()
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
    await user.click(await screen.findByRole('button', { name: 'Save Groceries' }))
    await waitFor(() => expect(updateExpenseActual).toHaveBeenCalledWith(5, { amount: 620 }))

    await user.click(await screen.findByRole('button', { name: 'Edit Groceries' }))
    const expensesTable = (await screen.findAllByRole('table'))[0]!
    await user.click(within(expensesTable).getByRole('button', { name: 'Delete Groceries entry' }))
    await waitFor(() => expect(deleteExpenseActual).toHaveBeenCalledWith(5))
  })

  it('shows a link to view all entries when an expense has multiple actuals that month', async () => {
    setDefaultMocks()
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

    expect(await screen.findByText('Multiple entries')).toBeInTheDocument()
    const viewAll = screen.getByRole('link', { name: 'View all →' })
    expect(viewAll.getAttribute('href')).toBe('/expenses/1')
    expect(screen.queryByRole('button', { name: 'Save Groceries' })).toBeNull()
  })

  it('cancels editing an expense line', async () => {
    setDefaultMocks()
    vi.mocked(listExpenseActuals).mockResolvedValue([])
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Edit Electricity' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel editing Electricity' }))

    expect(upsertUtilityBill).not.toHaveBeenCalled()
  })

  it('shows an error when loading actuals for an expense edit fails', async () => {
    setDefaultMocks()
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
    await user.click(screen.getByRole('button', { name: 'Save Electricity' }))

    expect(await screen.findByText('Could not save actual')).toBeInTheDocument()
  })

  it('shows an error when removing an expense actual fails', async () => {
    setDefaultMocks()
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
    const expensesTable = (await screen.findAllByRole('table'))[0]!
    await user.click(within(expensesTable).getByRole('button', { name: 'Delete Groceries entry' }))

    expect(await screen.findByText('Could not remove actual')).toBeInTheDocument()
  })

  it('shows expense and income totals in the table footers', async () => {
    setDefaultMocks()
    render(MonthPage)

    // Table order: expenses, then the carryover mini-table, then income.
    const tables = await screen.findAllByRole('table')
    const incomeFooter = tables[2]!.querySelector('tfoot')!
    expect(within(incomeFooter).getAllByText('$5,000.00')).toHaveLength(2)
    expect(within(tables[0]!).getByText('$700.00')).toBeInTheDocument()
    expect(within(tables[0]!).getByText('$730.00')).toBeInTheDocument()
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

    // Expenses table renders first now, so it's tables[0].
    const tables = await screen.findAllByRole('table')
    expect(within(tables[0]!).getByText('Water (shared)')).toBeInTheDocument()
    expect(within(tables[0]!).queryByRole('button', { name: /^Edit / })).toBeNull()
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
    expect(screen.getByRole('link', { name: 'Internet' }).getAttribute('href')).toBe(
      '/bills#bill-3'
    )
    expect(screen.getByRole('link', { name: 'Netflix (Brian)' }).getAttribute('href')).toBe(
      '/subscriptions'
    )
  })
})
