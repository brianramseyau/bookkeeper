import { api } from '$lib/api'

export type UtilityFrequency = 'monthly' | 'quarterly' | 'biannual' | 'annual'

export interface Utility {
  id: number
  name: string
  categoryId: number | null
  frequency: UtilityFrequency
  /** Days after the billing period's month-end that payment is due - null if unknown. */
  dueOffsetDays: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UtilityBill {
  id: number
  utilityId: number
  year: number
  month: number
  amount: number
  notes: string | null
  paid: boolean
  createdAt: string
  updatedAt: string
}

export interface UtilityTrend {
  average: number | null
  latestAmount: number | null
  latestYear: number | null
  latestMonth: number | null
  trend: 'up' | 'down' | 'flat' | null
  months: { year: number; month: number; amount: number }[]
}

/**
 * A calendar month covered by a non-monthly bill entered in a different
 * month (e.g. the Feb and Mar share of a quarterly Water bill billed in
 * Apr) - a computed read-only figure, not something with its own row to edit.
 */
export interface UtilityMonthlyShare {
  year: number
  month: number
  amount: number
  /** The month the real bill covering this share was actually entered in. */
  billYear: number
  billMonth: number
}

export interface UtilityBillsResponse {
  bills: UtilityBill[]
  monthlyShares: UtilityMonthlyShare[]
}

export function listUtilities() {
  return api.get<Utility[]>('/utilities')
}

export function createUtility(name: string) {
  return api.post<Utility>('/utilities', { name })
}

export function updateUtility(
  id: number,
  input: { frequency?: UtilityFrequency; dueOffsetDays?: number | null }
) {
  return api.patch<Utility>(`/utilities/${id}`, input)
}

export function getUtilityBills(utilityId: number) {
  return api.get<UtilityBillsResponse>(`/utilities/${utilityId}/bills`)
}

export function getUtilityTrend(utilityId: number) {
  return api.get<UtilityTrend>(`/utilities/${utilityId}/trend`)
}

export function upsertUtilityBill(
  utilityId: number,
  year: number,
  month: number,
  amount: number,
  paid?: boolean
) {
  return api.put<UtilityBill>(`/utilities/${utilityId}/bills/${year}/${month}`, {
    amount,
    ...(paid !== undefined ? { paid } : {}),
  })
}

export function deleteUtilityBill(id: number) {
  return api.delete<void>(`/utility-bills/${id}`)
}
