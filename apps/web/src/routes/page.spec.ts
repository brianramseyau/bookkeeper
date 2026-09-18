import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { goto, replaceState } from '$app/navigation'
import { page } from '$app/state'
import { getDashboardSummary, type DashboardSummary } from '$lib/api/dashboard'
import { ApiError } from '$lib/api'
import { authState } from '$lib/stores/auth.svelte'
import DashboardPage from './+page.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn(), replaceState: vi.fn() }))
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }))
vi.mock('$lib/api/dashboard', () => ({ getDashboardSummary: vi.fn() }))

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
  monthlyIncome: [],
}

describe('dashboard page', () => {
  beforeEach(() => {
    // Fixes "now" so isCurrentMonth/"This Month" behave deterministically -
    // matches baseSummary's currentMonth of March 2026.
    vi.setSystemTime(new Date('2026-03-15T00:00:00.000Z'))
    setPageUrl('http://localhost/')
    vi.mocked(getDashboardSummary).mockReset()
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

  it('shows the "Right now" and "Over time" zones', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)

    expect(await screen.findByRole('heading', { name: 'Right now' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Over time' })).toBeInTheDocument()
  })

  it('shows this month’s position, coloured by sign', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)

    expect(await screen.findByText('Position')).toBeInTheDocument()
    const value = await screen.findByText('-$50.00')
    expect(value.className).toContain('text-over')
  })

  it('shows the delta vs the standard-month projection', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)

    // actualNet (-50) - projectedNet (500) = -550, behind plan.
    expect(await screen.findByText('vs projected')).toBeInTheDocument()
    expect(screen.getByText('-$550.00')).toBeInTheDocument()
    expect(screen.getByText('Behind the standard-month plan')).toBeInTheDocument()
  })

  it('shows an ahead-of-plan delta with an explicit + sign', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      currentMonth: { year: 2026, month: 3, projectedNet: 100, actualNet: 400 },
    })
    render(DashboardPage)

    expect(await screen.findByText('+$300.00')).toBeInTheDocument()
    expect(screen.getByText('Ahead of the standard-month plan')).toBeInTheDocument()
  })

  it('shows plain income vs expenses for the viewed month only, not the 12-month totals', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      // 12-month totals that must NOT be what the card shows - it should
      // pick out only the March 2026 (currentMonth) entry below.
      totalIncome: 20000,
      monthlyExpenses: [
        { year: 2026, month: 2, total: 10000 },
        { year: 2026, month: 3, total: 750 },
      ],
      monthlyIncome: [
        { year: 2026, month: 2, total: 9000 },
        { year: 2026, month: 3, total: 1000 },
      ],
    })
    render(DashboardPage)

    expect(await screen.findByText('Income vs expenses')).toBeInTheDocument()
    // March only: 1000 - 750 = 250, a surplus - distinct from Position's
    // actualNet (-50) and from the 12-month totals above.
    expect(screen.getByText('$250.00')).toBeInTheDocument()
    expect(screen.getByText('Surplus this month')).toBeInTheDocument()
  })

  it('shows a deficit when expenses exceed income for the viewed month', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      monthlyExpenses: [{ year: 2026, month: 3, total: 600 }],
      monthlyIncome: [{ year: 2026, month: 3, total: 400 }],
    })
    render(DashboardPage)

    const value = await screen.findByText('-$200.00')
    expect(value.className).toContain('text-over')
    expect(screen.getByText('Deficit this month')).toBeInTheDocument()
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

  it('calls goto from the net position trend chart', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      monthlyExpenses: [
        { year: 2026, month: 1, total: 100 },
        { year: 2026, month: 2, total: 200 },
      ],
      monthlyIncome: [
        { year: 2026, month: 1, total: 150 },
        { year: 2026, month: 2, total: 250 },
      ],
    })
    render(DashboardPage)

    const chart = await screen.findByRole('button', { name: /Income, expenses and net position/ })
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

    await screen.findByText('November 2025')
    expect(getDashboardSummary).toHaveBeenCalledWith(2025, 11)
  })

  it('navigates to the previous and next month, wrapping the year, and updates URL params', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    const user = userEvent.setup()
    render(DashboardPage)
    await screen.findByText('March 2026')

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByText('February 2026')).toBeInTheDocument()
    expect(replaceState).toHaveBeenCalledWith('/?year=2026&month=2', {})
    expect(getDashboardSummary).toHaveBeenLastCalledWith(2026, 2)

    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'Previous month' }))
    }
    await waitFor(() => expect(getDashboardSummary).toHaveBeenLastCalledWith(2025, 12))
    expect(await screen.findByText('December 2025')).toBeInTheDocument()
  })

  it('jumps back to the current month', async () => {
    setPageUrl('http://localhost/?year=2020&month=1')
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    const user = userEvent.setup()
    render(DashboardPage)
    await screen.findByText('January 2020')

    await user.click(screen.getByRole('button', { name: 'January 2020' }))

    await waitFor(() => expect(getDashboardSummary).toHaveBeenLastCalledWith(2026, 3))
    expect(replaceState).toHaveBeenCalledWith('/', {})
  })
})
