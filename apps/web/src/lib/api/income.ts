import { api } from '$lib/api'

export interface IncomeSource {
  id: number
  userId: number
  name: string
  expectedAmount: number
  isActive: boolean
  notes: string | null
}

export interface IncomeSourceInput {
  userId: number
  name: string
  expectedAmount: number
  notes?: string | null
}

export interface IncomeEntry {
  id: number
  incomeSourceId: number | null
  userId: number | null
  year: number
  month: number
  receivedOn: string | null
  amount: number
  note: string | null
}

export interface IncomeEntryInput {
  incomeSourceId?: number | null
  userId?: number | null
  year: number
  month: number
  receivedOn?: string | null
  amount: number
  note?: string | null
}

export function listIncomeSources() {
  return api.get<IncomeSource[]>('/income-sources')
}

export function createIncomeSource(input: IncomeSourceInput) {
  return api.post<IncomeSource>('/income-sources', input)
}

export function updateIncomeSource(id: number, input: Partial<IncomeSourceInput>) {
  return api.patch<IncomeSource>(`/income-sources/${id}`, input)
}

export function deleteIncomeSource(id: number) {
  return api.delete<void>(`/income-sources/${id}`)
}

export function listIncomeEntries(year?: number, month?: number) {
  const params = new URLSearchParams()
  if (year) params.set('year', String(year))
  if (month) params.set('month', String(month))
  const query = params.toString() ? `?${params.toString()}` : ''
  return api.get<IncomeEntry[]>(`/income-entries${query}`)
}

export function createIncomeEntry(input: IncomeEntryInput) {
  return api.post<IncomeEntry>('/income-entries', input)
}

export function updateIncomeEntry(id: number, input: Partial<IncomeEntryInput>) {
  return api.patch<IncomeEntry>(`/income-entries/${id}`, input)
}

export function deleteIncomeEntry(id: number) {
  return api.delete<void>(`/income-entries/${id}`)
}
