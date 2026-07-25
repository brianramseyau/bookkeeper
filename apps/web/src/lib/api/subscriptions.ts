import { api } from '$lib/api'

export interface UserSubscription {
  id: number
  userId: number
  name: string
  categoryId: number | null
  amount: number
  dayOfMonth: number | null
  includeInStandardMonth: boolean
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SubscriptionSummary {
  userId: number
  fullName: string | null
  total: number
  count: number
}

export interface SubscriptionInput {
  userId: number
  name: string
  categoryId?: number | null
  amount: number
  dayOfMonth?: number | null
  notes?: string | null
}

export function listSubscriptions(userId?: number) {
  const query = userId ? `?userId=${userId}` : ''
  return api.get<UserSubscription[]>(`/subscriptions${query}`)
}

export function getSubscriptionsSummary() {
  return api.get<SubscriptionSummary[]>('/subscriptions/summary')
}

export function createSubscription(input: SubscriptionInput) {
  return api.post<UserSubscription>('/subscriptions', input)
}

export function updateSubscription(id: number, input: Partial<SubscriptionInput>) {
  return api.patch<UserSubscription>(`/subscriptions/${id}`, input)
}

export function deleteSubscription(id: number) {
  return api.delete<void>(`/subscriptions/${id}`)
}
