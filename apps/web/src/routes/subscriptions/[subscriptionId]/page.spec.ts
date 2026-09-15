import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionDetailPage from './+page.svelte'

vi.mock('$app/state', () => ({ page: { params: { subscriptionId: '4' } } }))
vi.mock('$lib/api/subscriptions', () => ({
  getSubscription: vi.fn().mockResolvedValue({
    id: 4,
    userId: 1,
    name: 'Netflix',
    categoryId: null,
    amount: 22.99,
    dayOfMonth: 4,
    isRecurring: true,
    isActive: true,
    isPaused: false,
    isArchived: false,
    notes: null,
  }),
  getSubscriptionTrend: vi.fn().mockResolvedValue({
    average: 22.99,
    latestAmount: 22.99,
    latestYear: 2026,
    latestMonth: 3,
    trend: 'flat',
    months: [{ year: 2026, month: 3, amount: 22.99 }],
  }),
  listSubscriptionPayments: vi.fn().mockResolvedValue([]),
  listSubscriptions: vi.fn(),
  getSubscriptionsSummary: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  deleteSubscriptionPayment: vi.fn(),
}))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))
vi.mock('$lib/api/users', () => ({ listUsers: vi.fn().mockResolvedValue([]) }))

beforeEach(() => vi.clearAllMocks())

describe('Subscription detail page', () => {
  it('renders the shared detail view', async () => {
    render(SubscriptionDetailPage)

    expect(await screen.findByRole('heading', { name: 'Netflix' })).toBeInTheDocument()
  })
})
