import { api } from '$lib/api'

export type IncomeSourceFrequency = 'monthly' | 'fortnightly'

export interface IncomeSource {
  id: number
  userId: number
  name: string
  expectedAmount: number
  frequency: IncomeSourceFrequency
  payDayOfMonth: number | null
  weekendRollback: boolean
  anchorDate: string | null
  taxWithheld: boolean
  isActive: boolean
  notes: string | null
}

export interface IncomeSourceInput {
  userId: number
  name: string
  expectedAmount: number
  frequency: IncomeSourceFrequency
  payDayOfMonth?: number | null
  weekendRollback?: boolean
  anchorDate?: string | null
  taxWithheld?: boolean
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
  taxWithheld: boolean | null
}

export interface IncomeEntryInput {
  incomeSourceId?: number | null
  userId?: number | null
  year: number
  month: number
  receivedOn?: string | null
  amount: number
  note?: string | null
  taxWithheld?: boolean | null
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

/** Every income entry a user has within a given Jul-Jun financial year. */
export function listIncomeEntriesForFinancialYear(userId: number, financialYear: number) {
  return api.get<IncomeEntry[]>(`/income-entries?userId=${userId}&financialYear=${financialYear}`)
}

/**
 * Every income entry in a given Jul-Jun financial year, for all household
 * members. Source-tied entries don't reliably carry `userId` (the app's
 * forms store them with just `incomeSourceId`), so the Income page fetches
 * this and filters client-side by the selected user's sources.
 */
export function listAllIncomeEntriesForFinancialYear(financialYear: number) {
  return api.get<IncomeEntry[]>(`/income-entries?financialYear=${financialYear}`)
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

export interface IncomeSourceSummary {
  userId: number
  fullName: string | null
  total: number
  count: number
}

export function getIncomeSourcesSummary() {
  return api.get<IncomeSourceSummary[]>('/income-sources/summary')
}

export interface IncomeYtdMonth {
  year: number
  month: number
  bySource: Record<number, number>
  /** Real logged income for the month - never backfilled from projected. */
  actual: number
  /** What the user's sources were expected to pay that month (cadence math). */
  projected: number
  /** The legacy total: real income, falling back to projected for months nothing was logged. */
  total: number
  estimated: boolean
}

export interface IncomeYtd {
  financialYear: number
  sources: { id: number; name: string }[]
  months: IncomeYtdMonth[]
  ytdTotal: number
}

export function getIncomeYtd(userId: number, financialYear: number) {
  return api.get<IncomeYtd>(`/income-sources/ytd?userId=${userId}&financialYear=${financialYear}`)
}
