import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BillDetailPage from './+page.svelte'

vi.mock('$app/state', () => ({ page: { params: { billId: '1' } } }))
vi.mock('$lib/api/recurring-bills', () => ({
  listUpcomingRecurringBills: vi.fn(),
  getRecurringBill: vi.fn().mockResolvedValue({
    id: 1,
    name: 'Car Insurance',
    amount: 600,
    frequency: 'annual',
    dueDay: 15,
    dueMonth: 6,
    dueYear: 2026,
    categoryId: null,
    isActive: true,
    isPaused: false,
    isArchived: false,
    notes: null,
    nextDueOn: '2026-06-15',
    daysUntilDue: 3,
    dueSoon: true,
  }),
  createRecurringBill: vi.fn(),
  updateRecurringBill: vi.fn(),
  deleteRecurringBill: vi.fn(),
  listRecurringBillPayments: vi.fn().mockResolvedValue([]),
  getRecurringBillTrend: vi.fn().mockResolvedValue({
    average: 600,
    latestAmount: 600,
    latestYear: 2026,
    latestMonth: 6,
    trend: 'flat',
    months: [{ year: 2026, month: 6, amount: 600 }],
  }),
  deleteRecurringBillPayment: vi.fn(),
}))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn().mockResolvedValue([]) }))

beforeEach(() => vi.clearAllMocks())

describe('Bill detail page', () => {
  it('renders the shared detail view for the bill', async () => {
    render(BillDetailPage)

    expect(await screen.findByRole('heading', { name: 'Car Insurance' })).toBeInTheDocument()
  })
})
