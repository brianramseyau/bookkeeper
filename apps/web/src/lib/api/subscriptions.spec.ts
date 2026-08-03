import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createSubscription,
  deleteSubscription,
  getSubscriptionsSummary,
  listSubscriptions,
  updateSubscription,
  upsertSubscriptionPayment,
} from './subscriptions'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('subscriptions api', () => {
  it('lists all subscriptions when no user is given', () => {
    listSubscriptions()
    expect(api.get).toHaveBeenCalledWith('/subscriptions')
  })

  it('lists subscriptions filtered by user', () => {
    listSubscriptions({ userId: 2 })
    expect(api.get).toHaveBeenCalledWith('/subscriptions?userId=2')
  })

  it('lists hidden subscriptions', () => {
    listSubscriptions({ includeHidden: true })
    expect(api.get).toHaveBeenCalledWith('/subscriptions?includeHidden=true')
  })

  it('gets the subscriptions summary', () => {
    getSubscriptionsSummary()
    expect(api.get).toHaveBeenCalledWith('/subscriptions/summary')
  })

  it('creates a subscription', () => {
    createSubscription({ userId: 1, name: 'Kayo', amount: 45.99 })
    expect(api.post).toHaveBeenCalledWith('/subscriptions', {
      userId: 1,
      name: 'Kayo',
      amount: 45.99,
    })
  })

  it('updates a subscription', () => {
    updateSubscription(9, { amount: 50 })
    expect(api.patch).toHaveBeenCalledWith('/subscriptions/9', { amount: 50 })
  })

  it('deletes a subscription', () => {
    deleteSubscription(9)
    expect(api.delete).toHaveBeenCalledWith('/subscriptions/9')
  })

  it('upserts a subscription payment paid flag', () => {
    upsertSubscriptionPayment(9, 2026, 3, true)
    expect(api.put).toHaveBeenCalledWith('/subscriptions/9/payments/2026/3', {
      paid: true,
      amount: undefined,
    })
  })

  it('upserts a subscription payment amount override', () => {
    upsertSubscriptionPayment(9, 2026, 3, undefined, 24.99)
    expect(api.put).toHaveBeenCalledWith('/subscriptions/9/payments/2026/3', {
      paid: undefined,
      amount: 24.99,
    })
  })
})
