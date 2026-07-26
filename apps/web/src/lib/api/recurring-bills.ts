import { api } from '$lib/api'

export type RecurringBillFrequency = 'monthly' | 'quarterly' | 'biannual' | 'annual' | 'custom'
export type RecurringBillCustomIntervalUnit = 'days' | 'weeks' | 'months'

export interface RecurringBill {
  id: number
  name: string
  categoryId: number | null
  amount: number
  frequency: RecurringBillFrequency
  customIntervalValue: number | null
  customIntervalUnit: RecurringBillCustomIntervalUnit | null
  dueDay: number | null
  dueMonth: number | null
  dueYear: number | null
  nextDueOn: string | null
  isActive: boolean
  isPaused: boolean
  isArchived: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface UpcomingRecurringBill extends RecurringBill {
  daysUntilDue: number | null
  dueSoon: boolean
}

export interface RecurringBillPayment {
  id: number
  recurringBillId: number
  year: number
  month: number
  paid: boolean
  createdAt: string
  updatedAt: string
}

export interface RecurringBillInput {
  name: string
  categoryId?: number | null
  amount: number
  frequency: RecurringBillFrequency
  customIntervalValue?: number
  customIntervalUnit?: RecurringBillCustomIntervalUnit
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
  paid: boolean
) {
  return api.put<RecurringBillPayment>(
    `/recurring-bills/${recurringBillId}/payments/${year}/${month}`,
    { paid }
  )
}
