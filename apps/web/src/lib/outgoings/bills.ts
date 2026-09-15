import {
  createRecurringBill,
  deleteRecurringBill,
  deleteRecurringBillPayment,
  getRecurringBill,
  getRecurringBillTrend,
  listRecurringBillPayments,
  listUpcomingRecurringBills,
  updateRecurringBill,
  type RecurringBill,
  type RecurringBillFrequency,
  type RecurringBillInput,
} from '$lib/api/recurring-bills'
import { formatCurrency, formatDate, formatDaysUntilDue } from '$lib/format'
import { lifecycleState } from '$lib/lifecycle'
import type {
  OutgoingAdapter,
  OutgoingFormValues,
  OutgoingHistoryEntry,
  OutgoingTrend,
} from './types'

export const BILL_FREQUENCIES: { value: RecurringBillFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Biannual' },
  { value: 'annual', label: 'Annual' },
  { value: 'biennial', label: 'Every 2 years' },
  { value: 'triennial', label: 'Every 3 years' },
]

export function frequencyLabel(frequency: string): string {
  return BILL_FREQUENCIES.find((f) => f.value === frequency)?.label ?? frequency
}

/** A bill plus the computed due fields `list`/`get` attach (absent on a plain create/update response). */
export interface BillRow extends RecurringBill {
  nextDueOn?: string | null
  daysUntilDue?: number | null
  dueSoon?: boolean
}

function isoDueDate(item: RecurringBill): string {
  if (!item.dueDay || !item.dueMonth) return ''
  const year = item.dueYear ?? new Date().getFullYear()
  const month = String(item.dueMonth).padStart(2, '0')
  const day = String(item.dueDay).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toBillInput(values: OutgoingFormValues): RecurringBillInput {
  const notes = values.notes
  return {
    name: String(values.name ?? ''),
    amount: Number(values.amount),
    frequency: values.frequency as RecurringBillFrequency,
    nextDueOn: String(values.nextDueOn ?? ''),
    categoryId:
      values.categoryId === '' || values.categoryId === null ? null : Number(values.categoryId),
    notes: notes === null || notes === undefined || notes === '' ? null : String(notes),
  }
}

export const billsAdapter: OutgoingAdapter<BillRow> = {
  kind: 'bills',
  title: 'Bills',
  description: 'What we pay for, and when it is next due.',
  singular: 'Bill',
  emptyMessage: 'No bills yet. Add the first one to see when it is due.',
  supportsLifecycle: true,
  supportsGrouping: true,
  supportsReorder: false,
  hasHistory: true,
  columns: [
    { key: 'amount', label: 'Amount', align: 'right', money: true },
    { key: 'frequency', label: 'Frequency' },
    { key: 'nextDueOn', label: 'Next due', align: 'right' },
    { key: 'category', label: 'Category' },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Car insurance' },
    { key: 'amount', label: 'Amount', type: 'number', required: true, step: '0.01', min: 0 },
    {
      key: 'frequency',
      label: 'Frequency',
      type: 'select',
      required: true,
      options: BILL_FREQUENCIES,
    },
    {
      key: 'nextDueOn',
      label: 'Next due',
      type: 'date',
      required: true,
      hint: 'Only the day and month are kept - the bill repeats on that date.',
    },
    { key: 'categoryId', label: 'Category', type: 'category' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],

  list: (opts) => listUpcomingRecurringBills({ includeHidden: opts?.includeHidden }),
  get: (id) => getRecurringBill(id),
  create: (values) => createRecurringBill(toBillInput(values)),
  update: (id, values) => updateRecurringBill(id, toBillInput(values)),
  setLifecycle: (id, patch) => updateRecurringBill(id, patch),
  remove: (id) => deleteRecurringBill(id),
  trend: (id) => getRecurringBillTrend(id) as Promise<OutgoingTrend>,
  async history(id): Promise<OutgoingHistoryEntry[]> {
    const payments = await listRecurringBillPayments(id)
    return payments.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      paid: p.paid,
      amount: p.amount,
    }))
  },
  deleteHistory: (id) => deleteRecurringBillPayment(id),

  href: (item) => `/bills/${item.id}`,
  subtitle: (item, ctx) =>
    [frequencyLabel(item.frequency), ctx.categories.find((c) => c.id === item.categoryId)?.name]
      .filter(Boolean)
      .join(', '),
  group: (item) => item.frequency,
  groupOrder: BILL_FREQUENCIES.map((f) => f.value),
  groupLabel: frequencyLabel,
  state: (item) => lifecycleState(item),
  anchorId: (item) => `bill-${item.id}`,
  rowValues: (item, ctx) => ({
    amount: formatCurrency(item.amount),
    frequency: frequencyLabel(item.frequency),
    nextDueOn:
      item.daysUntilDue != null
        ? formatDaysUntilDue(item.daysUntilDue)
        : formatDate(item.nextDueOn ?? null),
    category: ctx.categories.find((c) => c.id === item.categoryId)?.name ?? 'Uncategorized',
  }),
  stats: (item, trend) => [
    { label: 'Amount', value: formatCurrency(item.amount) },
    { label: 'Frequency', value: frequencyLabel(item.frequency) },
    {
      label: 'Next due',
      value: formatDate(item.nextDueOn ?? null),
      hint: item.daysUntilDue != null ? formatDaysUntilDue(item.daysUntilDue) : undefined,
    },
    { label: '12-month average', value: formatCurrency(trend.average) },
  ],
  toFormValues: (item) => ({
    name: item.name,
    amount: item.amount,
    frequency: item.frequency,
    // Prefer the computed next-due date (which the API always resolves) over
    // the stored day/month: a bill that only ever had a day set (no month)
    // would otherwise open the edit form with a blank required date.
    nextDueOn: item.nextDueOn?.slice(0, 10) ?? isoDueDate(item),
    categoryId: item.categoryId ?? '',
    notes: item.notes ?? '',
  }),
}
