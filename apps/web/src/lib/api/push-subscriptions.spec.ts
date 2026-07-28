import { describe, expect, it, vi } from 'vitest'
import { api } from '$lib/api'
import {
  listPushSubscriptions,
  getPushPublicKey,
  createPushSubscription,
  deletePushSubscription,
  sendTestPushNotification,
} from './push-subscriptions'

vi.mock('$lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

describe('push subscriptions api', () => {
  it('lists registered devices', () => {
    listPushSubscriptions()
    expect(api.get).toHaveBeenCalledWith('/push-subscriptions')
  })

  it('gets the VAPID public key', () => {
    getPushPublicKey()
    expect(api.get).toHaveBeenCalledWith('/push-public-key')
  })

  it('registers a new subscription', () => {
    const payload = { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a', auth: 'b' } }
    createPushSubscription(payload)
    expect(api.post).toHaveBeenCalledWith('/push-subscriptions', payload)
  })

  it('deletes a subscription', () => {
    deletePushSubscription(5)
    expect(api.delete).toHaveBeenCalledWith('/push-subscriptions/5')
  })

  it('sends a test notification', () => {
    sendTestPushNotification()
    expect(api.post).toHaveBeenCalledWith('/push-subscriptions/test')
  })
})
