import { api } from '$lib/api'

export interface Utility {
  id: number
  name: string
  categoryId: number | null
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

export function listUtilities() {
  return api.get<Utility[]>('/utilities')
}

export function createUtility(name: string) {
  return api.post<Utility>('/utilities', { name })
}

export function getUtilityBills(utilityId: number) {
  return api.get<UtilityBill[]>(`/utilities/${utilityId}/bills`)
}

export function getUtilityTrend(utilityId: number) {
  return api.get<UtilityTrend>(`/utilities/${utilityId}/trend`)
}

export function upsertUtilityBill(utilityId: number, year: number, month: number, amount: number) {
  return api.put<UtilityBill>(`/utilities/${utilityId}/bills/${year}/${month}`, { amount })
}

export function deleteUtilityBill(id: number) {
  return api.delete<void>(`/utility-bills/${id}`)
}
