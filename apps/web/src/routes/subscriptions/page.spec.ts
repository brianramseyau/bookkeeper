import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '$lib/api'
import SubscriptionsPage from './+page.svelte'

vi.mock('$lib/api/users', () => ({
  listUsers: vi.fn().mockResolvedValue([
    { id: 1, fullName: 'Adam', email: 'a@test.local', displayColor: null, initials: 'A' },
  ]),
}))
vi.mock('$lib/api/subscriptions', () => ({
  listSubscriptions: vi.fn().mockResolvedValue([]),
  getSubscriptionsSummary: vi.fn().mockResolvedValue([
    { userId: 1, fullName: 'Adam', total: 0, count: 0 },
  ]),
  getSubscription: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  listSubscriptionPayments: vi.fn(),
  getSubscriptionTrend: vi.fn(),
  deleteSubscriptionPayment: vi.fn(),
}))
vi.mock('$lib/api/categories', () => ({ listCategories: vi.fn().mockResolvedValue([]) }))

import { listUsers } from '$lib/api/users'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listUsers).mockResolvedValue([
    { id: 1, fullName: 'Adam', email: 'a@test.local', displayColor: null, initials: 'A' },
  ])
})

describe('Subscriptions page', () => {
  it('renders the list with the per-person switcher', async () => {
    render(SubscriptionsPage)

    expect(await screen.findByRole('button', { name: /Adam/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Subscriptions' })).toBeInTheDocument()
  })

  it('shows an explanatory empty state (not a stuck skeleton) when there are no users', async () => {
    vi.mocked(listUsers).mockResolvedValue([])
    render(SubscriptionsPage)

    expect(await screen.findByText(/No household members found/)).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    vi.mocked(listUsers).mockRejectedValue(new ApiError(500, 'Boom'))
    render(SubscriptionsPage)

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })
})
