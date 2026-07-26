import { fireEvent, render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { goto } from '$app/navigation'
import { getDashboardSummary, type DashboardSummary } from '$lib/api/dashboard'
import { ApiError } from '$lib/api'
import { authState } from '$lib/stores/auth.svelte'
import DashboardPage from './+page.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))
vi.mock('$lib/api/dashboard', () => ({ getDashboardSummary: vi.fn() }))

const baseSummary: DashboardSummary = {
  currentMonth: { year: 2026, month: 3, projectedNet: 500, actualNet: -50 },
  upcomingBills: [],
  utilities: [],
  monthlyExpenses: [],
}

describe('dashboard page', () => {
  beforeEach(() => {
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
    expect(screen.getByText('Loading…')).toBeInTheDocument()
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

  it('shows projected/actual net tiles with color classes for positive and negative values', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)

    const projected = await screen.findByText('$500.00')
    expect(projected.className).toContain('text-emerald-600')
    const actual = screen.getByText('-$50.00')
    expect(actual.className).toContain('text-red-600')
  })

  it('shows "Nothing scheduled" when there are no upcoming bills', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)
    expect(await screen.findByText('Nothing scheduled')).toBeInTheDocument()
    expect(screen.getByText('Nothing scheduled.')).toBeInTheDocument()
  })

  it('shows the next bill and "Nothing else scheduled" with exactly one upcoming bill', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      upcomingBills: [
        { id: 1, name: 'Rent', amount: 2000, nextDueOn: '2026-04-01', daysUntilDue: 5 },
      ],
    })
    render(DashboardPage)

    expect(await screen.findByText('$2,000.00')).toBeInTheDocument()
    expect(screen.getByText(/Rent/)).toBeInTheDocument()
    expect(screen.getByText('Nothing else scheduled.')).toBeInTheDocument()
  })

  it('lists remaining upcoming bills, highlighting overdue ones', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      upcomingBills: [
        { id: 1, name: 'Rent', amount: 2000, nextDueOn: '2026-04-01', daysUntilDue: 5 },
        { id: 2, name: 'Overdue Bill', amount: 40, nextDueOn: '2026-03-01', daysUntilDue: -2 },
      ],
    })
    render(DashboardPage)

    const overdueText = await screen.findByText('Overdue by 2 days')
    expect(overdueText.className).toContain('text-red-600')
  })

  it('renders utilities with a link to their detail page and calls goto from the chart', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue({
      ...baseSummary,
      monthlyExpenses: [
        { year: 2026, month: 1, total: 100 },
        { year: 2026, month: 2, total: 200 },
      ],
      utilities: [
        {
          id: 7,
          name: 'Electricity',
          latestAmount: 100,
          average: 90,
          trend: 'up',
          sparkline: [1, 2, 3],
        },
      ],
    })
    render(DashboardPage)

    const link = await screen.findByRole('link', { name: /Electricity/ })
    expect(link.getAttribute('href')).toBe('/utilities/7')

    const chart = screen.getByRole('button', { name: /Monthly expenses/ })
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
    expect(goto).toHaveBeenCalledWith('/month?year=2026&month=2')
  })

  it('does not render a utilities section when there are none', async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(baseSummary)
    render(DashboardPage)
    await screen.findByText('Nothing scheduled')
    expect(screen.queryByText('Utilities')).toBeNull()
  })
})
