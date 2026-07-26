import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  createSubscription,
  deleteSubscription,
  getSubscriptionsSummary,
  listSubscriptions,
  updateSubscription,
} from './subscriptions'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('subscriptions api', () => {
  it('lists all subscriptions when no user is given', () => {
    listSubscriptions()
    expect(api.get).toHaveBeenCalledWith('/subscriptions')
  })

  it('lists subscriptions filtered by user', () => {
    listSubscriptions(2)
    expect(api.get).toHaveBeenCalledWith('/subscriptions?userId=2')
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
})
