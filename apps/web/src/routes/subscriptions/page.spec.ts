import { render, screen } from '@testing-library/svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '$lib/api'
import SubscriptionsPage from './+page.svelte'

vi.mock('$lib/api/users', () => ({
  listUsers: vi
    .fn()
    .mockResolvedValue([
      { id: 1, fullName: 'Adam', email: 'a@test.local', displayColor: null, initials: 'A' },
    ]),
}))
vi.mock('$lib/api/subscriptions', () => ({
  listSubscriptions: vi.fn().mockResolvedValue([]),
  getSubscriptionsSummary: vi
    .fn()
    .mockResolvedValue([{ userId: 1, fullName: 'Adam', total: 0, count: 0 }]),
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
import { authState } from '$lib/stores/auth.svelte'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listUsers).mockResolvedValue([
    { id: 1, fullName: 'Adam', email: 'a@test.local', displayColor: null, initials: 'A' },
  ])
})

describe('Subscriptions page', () => {
  it("selects the logged-in user's tab by default", async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { id: 1, fullName: 'Adam', email: 'a@test.local', displayColor: null, initials: 'A' },
      { id: 2, fullName: 'Bea', email: 'b@test.local', displayColor: null, initials: 'B' },
    ])
    const original = authState.user
    authState.user = { id: 2, email: 'b@test.local', fullName: 'Bea' } as typeof authState.user
    render(SubscriptionsPage)

    const bea = await screen.findByRole('button', { name: /Bea/ })
    expect(bea.className).toContain('border-primary')
    authState.user = original
  })

  it('renders the list with the per-person switcher', async () => {
    render(SubscriptionsPage)

    expect(await screen.findByRole('button', { name: /Adam/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Subscriptions' })).toBeInTheDocument()
  })

  it('shows an explanatory empty state (not a stuck skeleton) when there are no users', async () => {
    vi.mocked(listUsers).mockResolvedValue([])
    render(SubscriptionsPage)

    expect(
      await screen.findByText(
        'No household members found. A subscription needs a person to belong to.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
  })

  it('shows an API error message when loading fails', async () => {
    vi.mocked(listUsers).mockRejectedValue(new ApiError(500, 'Boom'))
    render(SubscriptionsPage)

    expect(await screen.findByText('Boom')).toBeInTheDocument()
  })

  it('falls back to a generic message for a non-API failure', async () => {
    vi.mocked(listUsers).mockRejectedValue(new TypeError('Failed to fetch'))
    render(SubscriptionsPage)

    expect(await screen.findByText('Failed to load subscriptions')).toBeInTheDocument()
  })
})
