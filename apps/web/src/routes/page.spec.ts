import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { goto, replaceState } from '$app/navigation'
import { page } from '$app/state'
import { getDashboardSummary, type DashboardSummary } from '$lib/api/dashboard'
import { getStandardMonth, type StandardMonthResult } from '$lib/api/standard-month'
import { ApiError } from '$lib/api'
import { authState } from '$lib/stores/auth.svelte'
import DashboardPage from './+page.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }))
vi.mock('$lib/api/dashboard', () => ({ getDashboardSummary: vi.fn() }))
vi.mock('$lib/api/standard-month', () => ({ getStandardMonth: vi.fn() }))

// SvelteKit's real `Page.url` type brands `pathname` with a union of the
// app's known routes - the mock above is a plain URL, so route it through a
// cast here rather than fighting that type at every call site below.
function setPageUrl(url: string) {
  page.url = new URL(url) as unknown as typeof page.url
}

const baseSummary: DashboardSummary = {
  currentMonth: { year: 2026, month: 3, projectedNet: 500, actualNet: -50 },
  upcomingBills: [],
  monthlyExpenses: [],
  categoryBreakdown: [],
  totalIncome: 0,
}

const baseStandardMonth: StandardMonthResult = {
  year: 2026,
  month: 3,
  carryover: 0,
  income: { lines: [], projectedTotal: 0, actualTotal: 0 },
  expenses: { lines: [], projectedTotal: 0, actualTotal: 0 },
  projectedNet: 500,
  actualNet: -50,
}

describe('dashboard page', () => {
  beforeEach(() => {
    // Fixes "now" so isCurrentMonth/"This Month" behave deterministically -
    // matches baseSummary's currentMonth of March 2026.
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    setPageUrl('http://localhost/')
    vi.mocked(getDashboardSummary).mockReset()
    vi.mocked(getStandardMonth).mockReset()
    vi.mocked(getStandardMonth).mockResolvedValue(baseStandardMonth)
    vi.mocked(replaceState).mockReset()
    authState.user = {
      id: 1,
      fullName: 'Brian',
      email: 'brian@example.com',
      displayColor: null,
      initials: 'B',
    }
  })

  it('greets the user by full name', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)
    expect(screen.getByText('Welcome, Brian')).toBeInTheDocument()
  })

  it('falls back to email when the user has no full name', async () => {
    authState.user = {
      id: 1,
      fullName: null,
      email: 'brian@example.com',
      displayColor: null,
      initials: 'B',
    }
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)
    expect(screen.getByText('Welcome, brian@example.com')).toBeInTheDocument()
  })

  it('shows a loading state before data arrives', () => {
    vi.mocked(getDashboardSummary).mockReturnValue(new Promise(() => {}))
    vi.mocked(getStandardMonth).mockReturnValue(new Promise(() => {}))
    render(DashboardPage)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows an API error message on failure', async () => {
    vi.mocked(getDashboardSummary).mockRejectedValue(new ApiError(500, 'Server exploded'))
    render(DashboardPage)
    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
  })

  it('shows a generic error message for a non-API failure', async () => {
    vi.mocked(getDashboardSummary).mockRejectedValue(new Error('boom'))
    render(DashboardPage)
    expect(await screen.findByText('Failed to load dashboard')).toBeInTheDocument()
  })

  it('renders the month strip hero with the projected surplus', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)

    expect(await screen.findByText('projected surplus')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
  })

  it('still shows the summary when the month strip fails to load', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    vi.mocked(getStandardMonth).mockRejectedValue(new ApiError(500, 'strip boom'))
    render(DashboardPage)

    expect(
      await screen.findByText('Could not load the month strip for this month.')
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Upcoming bills' })).toBeInTheDocument()
  })

  it('links each upcoming bill to its detail page', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      upcomingBills: [
        { id: 1, name: 'Rent', amount: 2000, nextDueOn: '2026-04-01', daysUntilDue: 5 },
      ],
    })
    render(DashboardPage)

    const link = await screen.findByRole('link', { name: 'Rent' })
    expect(link).toHaveAttribute('href', '/bills/1')
    expect(screen.getByText('$2,000.00')).toBeInTheDocument()
    expect(screen.queryByText('Nothing scheduled.')).toBeNull()
  })

  it('shows "Nothing scheduled." when there are no upcoming bills', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)
    expect(await screen.findByText('Nothing scheduled.')).toBeInTheDocument()
  })

  it('highlights overdue upcoming bills', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      upcomingBills: [
        { id: 1, name: 'Rent', amount: 2000, nextDueOn: '2026-04-01', daysUntilDue: 5 },
        { id: 2, name: 'Overdue Bill', amount: 40, nextDueOn: '2026-03-01', daysUntilDue: -2 },
      ],
    })
    render(DashboardPage)

    const overdueText = await screen.findByText('Overdue by 2 days')
    expect(overdueText.className).toContain('text-over')
  })

  it('calls goto from the monthly expense chart', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      monthlyExpenses: [
        { year: 2026, month: 1, total: 100 },
        { year: 2026, month: 2, total: 200 },
      ],
    })
    render(DashboardPage)

    const chart = await screen.findByRole('button', { name: /Monthly expenses/ })
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
      width: 720,
      height: 240,
      left: 0,
      top: 0,
      right: 720,
      bottom: 240,
      x: 0,
      y: 0,
      toJSON: () => {},
    })
    await fireEvent.pointerMove(chart, { clientX: 700, clientY: 100 })
    await fireEvent.click(chart)
    expect(goto).toHaveBeenCalledWith('/monthly?year=2026&month=2')
  })

  it('shows the category breakdown ranked by spend', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      categoryBreakdown: [
        { id: 1, name: 'Utilities', color: '#0066b2', total: 400 },
        { id: 2, name: 'Groceries', color: '#72b258', total: 300 },
      ],
    })
    render(DashboardPage)

    expect(await screen.findByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('$400.00')).toBeInTheDocument()
  })

  it('shows a placeholder when there is no category spend yet', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)
    expect(await screen.findByText('No spend recorded yet')).toBeInTheDocument()
  })

  it('reads year/month from the URL and requests that month', async () => {
    setPageUrl('http://localhost/?year=2025&month=11')
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      currentMonth: { year: 2025, month: 11, projectedNet: 500, actualNet: -50 },
    })
    render(DashboardPage)

    await screen.findByText('Nov 2025')
    expect(getDashboardSummary).toHaveBeenCalledWith(2025, 11)
  })

  it('navigates to the previous and next month, wrapping the year, and updates URL params', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    const user = userEvent.setup()
    render(DashboardPage)
    await screen.findByText('Mar 2026')

    await user.click(screen.getByRole('button', { name: '← Prev' }))
    expect(await screen.findByText('Feb 2026')).toBeInTheDocument()
    expect(replaceState).toHaveBeenCalledWith('/?year=2026&month=2', {})
    expect(getDashboardSummary).toHaveBeenLastCalledWith(2026, 2)

    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: '← Prev' }))
    }
    await waitFor(() => expect(getDashboardSummary).toHaveBeenLastCalledWith(2025, 12))
    expect(await screen.findByText('Dec 2025')).toBeInTheDocument()
  })

  it('jumps back to the current month', async () => {
    setPageUrl('http://localhost/?year=2020&month=1')
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    const user = userEvent.setup()
    render(DashboardPage)
    await screen.findByText('Jan 2020')

    await user.click(screen.getByRole('button', { name: 'This Month' }))

    await waitFor(() => expect(getDashboardSummary).toHaveBeenLastCalledWith(2026, 3))
    expect(replaceState).toHaveBeenCalledWith('/', {})
  })

  it('shows the income vs expenses donut with the net position in its centre', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      monthlyExpenses: [
        { year: 2025, month: 9, total: 200 },
        { year: 2025, month: 10, total: 300 },
      ],
      totalIncome: 400,
    })
    render(DashboardPage)

    expect(await screen.findByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    // Centre shows income - expenses = 400 - 500 = -100 as a deficit.
    expect(screen.getByText('Deficit')).toBeInTheDocument()
    expect(screen.getByText('-$100.00')).toBeInTheDocument()
  })

  it('shows a surplus in the donut centre when income exceeds expenses', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      monthlyExpenses: [{ year: 2025, month: 9, total: 200 }],
      totalIncome: 500,
    })
    render(DashboardPage)

    expect(await screen.findByText('Surplus')).toBeInTheDocument()
    expect(screen.getByText('$300.00')).toBeInTheDocument()
  })

  it('shows the donut empty state when there is no income or expenses', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)
    expect(await screen.findByText('No income or expenses logged')).toBeInTheDocument()
  })
})
