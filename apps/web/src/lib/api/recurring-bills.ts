import { api } from '$lib/api'

export type RecurringBillFrequency =
  'monthly' | 'quarterly' | 'biannual' | 'annual' | 'biennial' | 'triennial'

export interface RecurringBill {
  id: number
  name: string
  categoryId: number | null
  amount: number
  frequency: RecurringBillFrequency
  dueDay: number | null
  dueMonth: number | null
  dueYear: number | null
  isActive: boolean
  isPaused: boolean
  isArchived: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface UpcomingRecurringBill extends RecurringBill {
  /** Computed from dueDay/dueMonth at request time - the next occurrence on or after today. */
  nextDueOn: string | null
  daysUntilDue: number | null
  dueSoon: boolean
}

export interface RecurringBillPayment {
  id: number
  recurringBillId: number
  year: number
  month: number
  paid: boolean
  amount: number | null
  createdAt: string
  updatedAt: string
}

export interface RecurringBillTrend {
  average: number | null
  latestAmount: number | null
  latestYear: number | null
  latestMonth: number | null
  trend: 'up' | 'down' | 'flat' | null
  months: { year: number; month: number; amount: number }[]
}

export interface RecurringBillInput {
  name: string
  categoryId?: number | null
  amount: number
  frequency: RecurringBillFrequency
  /** A one-off anchor date - only its day/month are kept, repeating indefinitely from there. */
  nextDueOn: string
  notes?: string | null
  isActive?: boolean
  isPaused?: boolean
  isArchived?: boolean
}

export function listUpcomingRecurringBills(opts?: { includeHidden?: boolean }) {
  const query = opts?.includeHidden ? '?includeHidden=true' : ''
  return api.get<UpcomingRecurringBill[]>(`/recurring-bills/upcoming${query}`)
}

export function getRecurringBill(id: number) {
  return api.get<UpcomingRecurringBill>(`/recurring-bills/${id}`)
}

export function listRecurringBillPayments(id: number) {
  return api.get<RecurringBillPayment[]>(`/recurring-bills/${id}/payments`)
}

export function getRecurringBillTrend(id: number) {
  return api.get<RecurringBillTrend>(`/recurring-bills/${id}/trend`)
}

export function deleteRecurringBillPayment(id: number) {
  return api.delete<void>(`/recurring-bill-payments/${id}`)
}

export function createRecurringBill(input: RecurringBillInput) {
  return api.post<RecurringBill>('/recurring-bills', input)
}

export function updateRecurringBill(id: number, input: Partial<RecurringBillInput>) {
  return api.patch<RecurringBill>(`/recurring-bills/${id}`, input)
}

export function deleteRecurringBill(id: number) {
  return api.delete<void>(`/recurring-bills/${id}`)
}

export function upsertRecurringBillPayment(
  recurringBillId: number,
  year: number,
  month: number,
  paid?: boolean,
  amount?: number
) {
  return api.put<RecurringBillPayment>(
    `/recurring-bills/${recurringBillId}/payments/${year}/${month}`,
    { paid, amount }
  )
}
