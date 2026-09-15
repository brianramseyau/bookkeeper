import { api } from '$lib/api'

export interface UserSubscription {
  id: number
  userId: number
  name: string
  categoryId: number | null
  amount: number
  dayOfMonth: number | null
  isRecurring: boolean
  isActive: boolean
  isPaused: boolean
  isArchived: boolean
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

export interface SubscriptionPayment {
  id: number
  userSubscriptionId: number
  year: number
  month: number
  paid: boolean
  amount: number | null
  createdAt: string
  updatedAt: string
}

export interface SubscriptionTrend {
  average: number | null
  latestAmount: number | null
  latestYear: number | null
  latestMonth: number | null
  trend: 'up' | 'down' | 'flat' | null
  months: { year: number; month: number; amount: number }[]
}

export interface SubscriptionInput {
  userId: number
  name: string
  categoryId?: number | null
  amount: number
  dayOfMonth?: number | null
  notes?: string | null
  isActive?: boolean
  isPaused?: boolean
  isArchived?: boolean
}

export function listSubscriptions(opts?: { userId?: number; includeHidden?: boolean }) {
  const params = new URLSearchParams()
  if (opts?.userId) params.set('userId', String(opts.userId))
  if (opts?.includeHidden) params.set('includeHidden', 'true')
  const query = params.toString() ? `?${params.toString()}` : ''
  return api.get<UserSubscription[]>(`/subscriptions${query}`)
}

export function getSubscriptionsSummary() {
  return api.get<SubscriptionSummary[]>('/subscriptions/summary')
}

export function getSubscription(id: number) {
  return api.get<UserSubscription>(`/subscriptions/${id}`)
}

export function listSubscriptionPayments(id: number) {
  return api.get<SubscriptionPayment[]>(`/subscriptions/${id}/payments`)
}

export function getSubscriptionTrend(id: number) {
  return api.get<SubscriptionTrend>(`/subscriptions/${id}/trend`)
}

export function deleteSubscriptionPayment(id: number) {
  return api.delete<void>(`/subscription-payments/${id}`)
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

export function upsertSubscriptionPayment(
  subscriptionId: number,
  year: number,
  month: number,
  paid?: boolean,
  amount?: number
) {
  return api.put<SubscriptionPayment>(
    `/subscriptions/${subscriptionId}/payments/${year}/${month}`,
    { paid, amount }
  )
}
