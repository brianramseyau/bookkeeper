import { api } from '$lib/api'

export interface PushSubscriptionRecord {
  id: number
  endpoint: string
  userAgent: string | null
  createdAt: string
}

export function listPushSubscriptions() {
  return api.get<PushSubscriptionRecord[]>('/push-subscriptions')
}

export function getPushPublicKey() {
  return api.get<{ publicKey: string }>('/push-public-key')
}

export interface CreatePushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export function createPushSubscription(payload: CreatePushSubscriptionPayload) {
  return api.post<PushSubscriptionRecord>('/push-subscriptions', payload)
}

export function deletePushSubscription(id: number) {
  return api.delete<void>(`/push-subscriptions/${id}`)
}

export function sendTestPushNotification() {
  return api.post<{ sent: number; pruned: number }>('/push-subscriptions/test')
}
