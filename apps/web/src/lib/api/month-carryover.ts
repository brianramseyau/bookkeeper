import { api } from '$lib/api'

export interface MonthCarryover {
  id: number
  year: number
  month: number
  amount: number
  notes: string | null
}

export function setMonthCarryover(year: number, month: number, amount: number) {
  return api.put<MonthCarryover>(`/month-carryovers/${year}/${month}`, { amount })
}
