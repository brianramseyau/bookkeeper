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
  createCategoryActual,
  deleteCategoryActual,
  listCategoryActuals,
  updateCategoryActual,
  type CategoryMonthlyActual,
} from '$lib/api/category-actuals'
import { upsertRecurringBillPayment } from '$lib/api/recurring-bills'
import { upsertSubscriptionPayment } from '$lib/api/subscriptions'
import { listUsers, type UserSummary } from '$lib/api/users'
import { ApiError } from '$lib/api'
import MonthPage from './+page.svelte'

vi.mock('$app/navigation', () => ({ replaceState: vi.fn() }))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/month') } }))
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
vi.mock('$lib/api/category-actuals', () => ({
  listCategoryActuals: vi.fn(),
  createCategoryActual: vi.fn(),
  updateCategoryActual: vi.fn(),
  deleteCategoryActual: vi.fn(),
}))
vi.mock('$lib/api/recurring-bills', () => ({ upsertRecurringBillPayment: vi.fn() }))
vi.mock('$lib/api/subscriptions', () => ({ upsertSubscriptionPayment: vi.fn() }))
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
          paid: false,
          editable: true,
        },
        {
          key: 'category-1',
          label: 'Groceries',
          projected: 600,
          actual: 620,
          dueDay: 5,
          dueDate: null,
          paid: true,
          editable: true,
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
    setPageUrl('http://localhost/month?year=2026&month=3')
    vi.mocked(getStandardMonth).mockReset()
    vi.mocked(listIncomeSources).mockReset()
    vi.mocked(listIncomeEntries).mockReset()
    vi.mocked(listUsers).mockReset()
    vi.mocked(setMonthCarryover).mockReset()
    vi.mocked(createIncomeEntry).mockReset()
    vi.mocked(updateIncomeEntry).mockReset()
    vi.mocked(deleteIncomeEntry).mockReset()
    vi.mocked(upsertUtilityBill).mockReset()
    vi.mocked(listCategoryActuals).mockReset()
    vi.mocked(createCategoryActual).mockReset()
    vi.mocked(updateCategoryActual).mockReset()
    vi.mocked(deleteCategoryActual).mockReset()
    vi.mocked(upsertRecurringBillPayment).mockReset()
    vi.mocked(upsertSubscriptionPayment).mockReset()
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
    setPageUrl('http://localhost/month')
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

    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]!)
    const input = screen.getByDisplayValue('500')
    await user.clear(input)
    await user.type(input, '750')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(setMonthCarryover).toHaveBeenCalledWith(2026, 3, 750))
    expect(getStandardMonth).toHaveBeenCalledTimes(2)
  })

  it('cancels editing the carried-over balance', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]!)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByDisplayValue('500')).toBeNull()
    expect(setMonthCarryover).not.toHaveBeenCalled()
  })

  it('shows an error when saving the carryover fails', async () => {
    setDefaultMocks()
    vi.mocked(setMonthCarryover).mockRejectedValue(new ApiError(500, 'Could not save carryover'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]!)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save carryover')).toBeInTheDocument()
  })

  it('navigates to the previous and next month, wrapping the year, and clears URL params', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)
    await screen.findByText('March 2026')

    await user.click(screen.getByRole('button', { name: '← Prev' }))
    expect(await screen.findByText('February 2026')).toBeInTheDocument()
    expect(replaceState).toHaveBeenCalledWith('/month', {})
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
    setPageUrl('http://localhost/month?year=2020&month=1')
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

  it('shows the pay-periods hint and resolves the owner name for an income line', async () => {
    setDefaultMocks()
    render(MonthPage)
    expect(await screen.findByText('Brian')).toBeInTheDocument()
    expect(screen.getAllByText('14 Mar 2026').length).toBe(2)
  })

  it('shows a "many pay periods" hint when a source has more than two pay dates', async () => {
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

    expect(await screen.findByText(/3 pay periods:/)).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
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

    // Edit buttons in DOM order: carryover(0), Groceries(1), Electricity(2),
    // then the income entry(3) - Expenses now renders above Income.
    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[3]!)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(updateIncomeEntry).toHaveBeenCalledWith(10, {
        amount: 5000,
        receivedOn: '2026-03-14',
        note: 'March pay',
      })
    )

    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(deleteIncomeEntry).toHaveBeenCalledWith(10))
  })

  it('clears the amount field to null (not blocked client-side) when saving an entry edit', async () => {
    // Svelte's number-input binding coerces an emptied field to `null`, not
    // `NaN` - so the `Number.isNaN` guard here never actually catches a
    // cleared field in practice, only a never-touched one (see the "requires
    // an amount to log income" test below for that path).
    setDefaultMocks()
    vi.mocked(updateIncomeEntry).mockResolvedValue(salaryEntry)
    const user = userEvent.setup()
    render(MonthPage)

    // Income entry's Edit button is index 3 - see comment above.
    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[3]!)
    const amountInput = screen.getByDisplayValue('5000')
    await user.clear(amountInput)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(updateIncomeEntry).toHaveBeenCalledWith(10, {
        amount: null,
        receivedOn: '2026-03-14',
        note: 'March pay',
      })
    )
  })

  it('shows an API error when saving an entry edit fails', async () => {
    setDefaultMocks()
    vi.mocked(updateIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not save entry'))
    const user = userEvent.setup()
    render(MonthPage)

    // Income entry's Edit button is index 3 - see comment above.
    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[3]!)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save entry')).toBeInTheDocument()
  })

  it('cancels editing an entry', async () => {
    setDefaultMocks()
    const user = userEvent.setup()
    render(MonthPage)

    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[1]!)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(updateIncomeEntry).not.toHaveBeenCalled()
  })

  it('shows an error when deleting an entry fails', async () => {
    setDefaultMocks()
    vi.mocked(deleteIncomeEntry).mockRejectedValue(new ApiError(500, 'Could not delete entry'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.click(await screen.findByRole('button', { name: 'Remove' }))

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

    await user.selectOptions(screen.getByLabelText('Source'), '1')
    await user.type(screen.getByLabelText('Amount'), '100')
    await user.type(screen.getByLabelText('Note'), 'extra')
    await user.click(screen.getByRole('button', { name: 'Log income' }))

    await waitFor(() =>
      expect(createIncomeEntry).toHaveBeenCalledWith({
        incomeSourceId: 1,
        year: 2026,
        month: 3,
        amount: 100,
        receivedOn: null,
        note: 'extra',
      })
    )
  })

  it('shows an API error when logging income fails', async () => {
    setDefaultMocks()
    vi.mocked(createIncomeEntry).mockRejectedValue(new ApiError(422, 'Could not log income'))
    const user = userEvent.setup()
    render(MonthPage)

    await user.type(await screen.findByLabelText('Amount'), '100')
    await user.click(screen.getByRole('button', { name: 'Log income' }))

    expect(await screen.findByText('Could not log income')).toBeInTheDocument()
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
              paid: false,
              editable: true,
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
              paid: false,
              editable: true,
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
              paid: false,
              editable: true,
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

  it('hides a utility due date when this month is only a predicted billing month with no actual entered yet', async () => {
    // A quarterly utility (e.g. Water) gets a predicted dueDate as soon as
    // the viewed month is cued up as its next billing month, even before
    // that quarter's bill has actually been entered - showing a countdown
    // to that guessed date reads as a real, imminent due date when nothing
    // concrete is actually known yet, so it should be hidden until `actual`
    // is set.
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
              paid: false,
              editable: true,
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
    expect(dueCell.textContent).toBe('—')
    expect(dueCell.getAttribute('title')).toBeNull()
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
              paid: false,
              editable: true,
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
    expect(dueCell.textContent).toBe('—')
    expect(dueCell.getAttribute('title')).toBeNull()
  })

  it('shows a Paid checkbox, checked per line, only for lines with a resolved due date', async () => {
    // Groceries is marked paid in the base fixture, Electricity isn't - and
    // sorts second (due later), so checkboxes[0] is Groceries' and
    // checkboxes[1] is Electricity's.
    setDefaultMocks()
    render(MonthPage)

    const checkboxes = await screen.findAllByRole('checkbox', { name: 'Paid' })
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
  })

  it('does not show a Paid checkbox for a category line or one with no due date', async () => {
    vi.mocked(getStandardMonth).mockResolvedValue(
      baseData({
        expenses: {
          lines: [
            {
              key: 'category-1',
              label: 'Groceries',
              projected: 300,
              actual: 300,
              dueDay: null,
              dueDate: null,
              paid: false,
              editable: true,
            },
            {
              key: 'recurring-bills-avg',
              label: 'Recurring Bills (avg)',
              projected: 5.42,
              actual: null,
              dueDay: null,
              dueDate: null,
              paid: false,
              editable: true,
            },
          ],
          projectedTotal: 305.42,
          actualTotal: 300,
        },
      })
    )
    vi.mocked(listIncomeSources).mockResolvedValue([])
    vi.mocked(listIncomeEntries).mockResolvedValue([])
    vi.mocked(listUsers).mockResolvedValue([])
    render(MonthPage)

    await screen.findByText('Groceries')
    expect(screen.queryByRole('checkbox', { name: 'Paid' })).toBeNull()
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
              paid: false,
              editable: true,
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
              paid: false,
              editable: true,
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
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    const checkbox = await screen.findByRole('checkbox', { name: 'Paid' })
    await user.click(checkbox)

    await waitFor(() => expect(upsertSubscriptionPayment).toHaveBeenCalledWith(9, 2026, 3, true))
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
      createdAt: '',
      updatedAt: '',
    })
    const user = userEvent.setup()
    render(MonthPage)

    // Edit buttons in DOM order: carryover(0), Groceries(1), Electricity(2) -
    // Expenses now renders above Income, and Groceries (dueDay 5) sorts
    // ahead of Electricity (dueDate 20th).
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[2]!)
    const amountInput = screen.getByDisplayValue('110')
    await user.clear(amountInput)
    await user.type(amountInput, '120')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(upsertUtilityBill).toHaveBeenCalledWith(1, 2026, 3, 120))
  })

  it('adds a category actual when none is logged yet', async () => {
    setDefaultMocks()
    vi.mocked(listCategoryActuals).mockResolvedValue([])
    vi.mocked(createCategoryActual).mockResolvedValue({} as CategoryMonthlyActual)
    const user = userEvent.setup()
    render(MonthPage)

    // Edit buttons in DOM order: carryover(0), Groceries(1) - see comment
    // in the "edits a utility expense line" test above.
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[1]!)
    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument()
    // The expense row's amount input is now the first spinbutton on the
    // page (Expenses renders above the Income section's "Log income" form,
    // whose Amount field is the other spinbutton).
    const amountInputs = screen.getAllByRole('spinbutton')
    await user.type(amountInputs[0]!, '650')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(createCategoryActual).toHaveBeenCalledWith(1, {
        occurredOn: '2026-03-31',
        amount: 650,
      })
    )
  })

  it('edits and removes a single existing category actual', async () => {
    setDefaultMocks()
    vi.mocked(listCategoryActuals).mockResolvedValue([
      {
        id: 5,
        categoryId: 1,
        occurredOn: '2026-03-10',
        amount: 620,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    vi.mocked(updateCategoryActual).mockResolvedValue({} as CategoryMonthlyActual)
    vi.mocked(deleteCategoryActual).mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(MonthPage)

    // Groceries's Edit button is index 1 - see comment in the "edits a
    // utility expense line" test above.
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[1]!)
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateCategoryActual).toHaveBeenCalledWith(5, { amount: 620 }))

    await user.click(
      await screen.findAllByRole('button', { name: 'Edit' }).then((btns) => btns[1]!)
    )
    const expensesTable = (await screen.findAllByRole('table'))[0]!
    await user.click(within(expensesTable).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(deleteCategoryActual).toHaveBeenCalledWith(5))
  })

  it('shows a link to view all entries when a category has multiple actuals that month', async () => {
    setDefaultMocks()
    vi.mocked(listCategoryActuals).mockResolvedValue([
      {
        id: 5,
        categoryId: 1,
        occurredOn: '2026-03-10',
        amount: 300,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 6,
        categoryId: 1,
        occurredOn: '2026-03-20',
        amount: 320,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    const user = userEvent.setup()
    render(MonthPage)

    // Groceries's Edit button is index 1 - see comment in the "edits a
    // utility expense line" test above.
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[1]!)

    expect(await screen.findByText('Multiple entries')).toBeInTheDocument()
    const viewAll = screen.getByRole('link', { name: 'View all →' })
    expect(viewAll.getAttribute('href')).toBe('/categories/1')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('cancels editing an expense line', async () => {
    setDefaultMocks()
    vi.mocked(listCategoryActuals).mockResolvedValue([])
    const user = userEvent.setup()
    render(MonthPage)

    // Electricity's Edit button is index 2 - see comment in the "edits a
    // utility expense line" test above.
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[2]!)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(upsertUtilityBill).not.toHaveBeenCalled()
  })

  it('shows an error when loading actuals for an expense edit fails', async () => {
    setDefaultMocks()
    vi.mocked(listCategoryActuals).mockRejectedValue(new ApiError(500, 'Could not load actuals'))
    const user = userEvent.setup()
    render(MonthPage)

    // Groceries's Edit button is index 1 - see comment in the "edits a
    // utility expense line" test above.
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[1]!)

    expect(await screen.findByText('Could not load actuals')).toBeInTheDocument()
  })

  it('shows an error when saving an expense edit fails', async () => {
    setDefaultMocks()
    vi.mocked(upsertUtilityBill).mockRejectedValue(new ApiError(500, 'Could not save actual'))
    const user = userEvent.setup()
    render(MonthPage)

    // Electricity's Edit button is index 2 - see comment in the "edits a
    // utility expense line" test above.
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[2]!)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Could not save actual')).toBeInTheDocument()
  })

  it('shows an error when removing an expense actual fails', async () => {
    setDefaultMocks()
    vi.mocked(listCategoryActuals).mockResolvedValue([
      {
        id: 5,
        categoryId: 1,
        occurredOn: '2026-03-10',
        amount: 620,
        notes: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    vi.mocked(deleteCategoryActual).mockRejectedValue(new ApiError(500, 'Could not remove actual'))
    const user = userEvent.setup()
    render(MonthPage)

    // Groceries's Edit button is index 1 - see comment in the "edits a
    // utility expense line" test above.
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await user.click(editButtons[1]!)
    const expensesTable = (await screen.findAllByRole('table'))[0]!
    await user.click(within(expensesTable).getByRole('button', { name: 'Remove' }))

    expect(await screen.findByText('Could not remove actual')).toBeInTheDocument()
  })

  it('shows expense and income totals in the table footers', async () => {
    setDefaultMocks()
    render(MonthPage)

    // Expenses table renders first now, so income's footer is tables[1].
    const tables = await screen.findAllByRole('table')
    const incomeFooter = tables[1]!.querySelector('tfoot')!
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
              paid: false,
              editable: false,
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
    expect(within(tables[0]!).queryByRole('button', { name: 'Edit' })).toBeNull()
  })
})
