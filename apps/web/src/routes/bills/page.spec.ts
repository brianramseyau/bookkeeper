import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BillsPage from './+page.svelte'

vi.mock('$lib/api/recurring-bills', () => ({
  listUpcomingRecurringBills: vi.fn().mockResolvedValue([]),
  getRecurringBill: vi.fn(),
  createRecurringBill: vi.fn(),
  updateRecurringBill: vi.fn(),
  deleteRecurringBill: vi.fn(),
  listRecurringBillPayments: vi.fn(),
  getRecurringBillTrend: vi.fn(),
  deleteRecurringBillPayment: vi.fn(),
}))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn().mockResolvedValue([]) }))

beforeEach(() => vi.clearAllMocks())

describe('Bills page', () => {
  it('renders the shared outgoings list', async () => {
    render(BillsPage)

    expect(await screen.findByRole('heading', { name: 'Bills' })).toBeInTheDocument()
    // Two "Add bill" buttons once loaded (page header + empty state) - assert
    // at least one rather than matching ambiguously mid-load.
    expect((await screen.findAllByRole('button', { name: 'Add bill' })).length).toBeGreaterThan(0)
  })
})
