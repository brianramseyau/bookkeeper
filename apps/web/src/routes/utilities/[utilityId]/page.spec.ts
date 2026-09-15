import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UtilityDetailPage from './+page.svelte'

vi.mock('$app/state', () => ({ page: { params: { utilityId: '3' } } }))
vi.mock('$lib/api/utilities', () => ({
  listUtilities: vi.fn().mockResolvedValue([
    {
      id: 3,
      name: 'Electricity',
      categoryId: null,
      frequency: 'monthly',
      dueOffsetDays: 14,
      dueOffsetBusinessDaysOnly: false,
      paidInAdvance: false,
      isActive: true,
    },
  ]),
  getUtilityTrend: vi.fn().mockResolvedValue({
    average: 120,
    latestAmount: 125,
    latestYear: 2026,
    latestMonth: 3,
    trend: 'up',
    months: [{ year: 2026, month: 3, amount: 125 }],
    nextDueOn: '2026-04-14',
  }),
  getUtilityBills: vi.fn().mockResolvedValue({ bills: [], monthlyShares: [] }),
  createUtility: vi.fn(),
  updateUtility: vi.fn(),
  deleteUtility: vi.fn(),
  upsertUtilityBill: vi.fn(),
  deleteUtilityBill: vi.fn(),
}))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn().mockResolvedValue([]) }))

beforeEach(() => vi.clearAllMocks())

describe('Utility detail page', () => {
  it('renders the shared detail view plus the FY bill grid', async () => {
    render(UtilityDetailPage)

    expect(await screen.findByRole('heading', { name: 'Electricity' })).toBeInTheDocument()
    expect(await screen.findByText('Bills by financial year')).toBeInTheDocument()
  })
})
