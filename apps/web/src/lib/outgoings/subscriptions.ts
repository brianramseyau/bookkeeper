import {
  createSubscription,
  deleteSubscription,
  deleteSubscriptionPayment,
  getSubscription,
  getSubscriptionTrend,
  listSubscriptionPayments,
  listSubscriptions,
  updateSubscription,
  upsertSubscriptionPayment,
  type SubscriptionInput,
  type UserSubscription,
} from '$lib/api/subscriptions'
import { formatCurrency } from '$lib/format'
import { lifecycleState } from '$lib/lifecycle'
import { byName, byValueAsc, byValueDesc } from './sort'
import type {
  OutgoingAdapter,
  OutgoingFormValues,
  OutgoingHistoryEntry,
  OutgoingTrend,
} from './types'

function toSubscriptionInput(values: OutgoingFormValues): SubscriptionInput {
  const notes = values.notes
  return {
    userId: Number(values.userId),
    name: String(values.name ?? ''),
    amount: Number(values.amount),
    dayOfMonth:
      values.dayOfMonth === '' || values.dayOfMonth === null ? null : Number(values.dayOfMonth),
    categoryId:
      values.categoryId === '' || values.categoryId === null ? null : Number(values.categoryId),
    notes: notes === null || notes === undefined || notes === '' ? null : String(notes),
  }
}

export const subscriptionsAdapter: OutgoingAdapter<UserSubscription> = {
  kind: 'subscriptions',
  title: 'Subscriptions',
  description: 'Recurring personal subscriptions, by person.',
  singular: 'Subscription',
  emptyMessage: 'No subscriptions yet. Add the first one to see the monthly total.',
  supportsLifecycle: true,
  hasHistory: true,
  sorts: [
    { value: 'name', label: 'Name (A-Z)', compare: byName },
    { value: 'amount', label: 'Amount (high to low)', compare: byValueDesc((sub) => sub.amount) },
    { value: 'billedOn', label: 'Billed on', compare: byValueAsc((sub) => sub.dayOfMonth) },
  ],
  defaultSort: 'name',
  columns: [
    { key: 'amount', label: 'Amount', align: 'right', money: true },
    { key: 'dayOfMonth', label: 'Billed on', align: 'right' },
    { key: 'category', label: 'Category' },
  ],
  fields: [
    { key: 'userId', label: 'For', type: 'user', required: true },
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Netflix' },
    { key: 'amount', label: 'Amount', type: 'number', required: true, step: '0.01', min: 0 },
    { key: 'dayOfMonth', label: 'Day of month', type: 'number', min: 1 },
    { key: 'categoryId', label: 'Category', type: 'category' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],

  list: (opts) => listSubscriptions({ includeHidden: opts?.includeHidden, userId: opts?.userId }),
  get: (id) => getSubscription(id),
  create: (values) => createSubscription(toSubscriptionInput(values)),
  update: (id, values) => updateSubscription(id, toSubscriptionInput(values)),
  setLifecycle: (id, patch) => updateSubscription(id, patch),
  remove: (id) => deleteSubscription(id),
  trend: (id) => getSubscriptionTrend(id) as Promise<OutgoingTrend>,
  async history(id): Promise<OutgoingHistoryEntry[]> {
    const payments = await listSubscriptionPayments(id)
    return payments.map((p) => ({
      id: p.id,
      year: p.year,
      month: p.month,
      paid: p.paid,
      amount: p.amount,
    }))
  },
  // `paid` is passed as `undefined`, not `entry.paid` - the API only merges a
  // field when it's present in the request (subscriptions_controller.ts's
  // upsertPayment), so sending the stale snapshot from when the detail page
  // loaded would silently revert a paid/unpaid change made since (e.g. from
  // the Monthly page, or the other household member). Matches what the
  // Monthly page's own line-edit sheet does for the same month.
  updateHistory: (id, entry, amount) =>
    upsertSubscriptionPayment(id, entry.year, entry.month, undefined, amount),
  deleteHistory: (id) => deleteSubscriptionPayment(id),

  href: (item) => `/subscriptions/${item.id}`,
  subtitle: (item, ctx) =>
    [
      ctx.users.find((u) => u.id === item.userId)?.fullName,
      ctx.categories.find((c) => c.id === item.categoryId)?.name,
    ]
      .filter(Boolean)
      .join(', '),
  state: (item) => lifecycleState(item),
  anchorId: (item) => `subscription-${item.id}`,
  rowValues: (item, ctx) => ({
    amount: formatCurrency(item.amount),
    dayOfMonth: item.dayOfMonth ? String(item.dayOfMonth) : '—',
    category: ctx.categories.find((c) => c.id === item.categoryId)?.name ?? 'Uncategorized',
  }),
  stats: (item, trend, ctx) => {
    const owner = ctx.users.find((u) => u.id === item.userId)
    const category = ctx.categories.find((c) => c.id === item.categoryId)
    return [
      { label: 'Amount', value: formatCurrency(item.amount) },
      { label: 'Billed on', value: item.dayOfMonth ? `Day ${item.dayOfMonth}` : 'Any day' },
      {
        label: 'Owner',
        value: owner?.fullName || owner?.email || 'Unknown',
        dot: owner?.displayColor ?? null,
      },
      {
        label: 'Category',
        value: category?.name ?? 'Uncategorized',
        dot: category?.color ?? null,
      },
      { label: '12-month average', value: formatCurrency(trend.average) },
    ]
  },
  toFormValues: (item) => ({
    userId: item.userId,
    name: item.name,
    amount: item.amount,
    dayOfMonth: item.dayOfMonth ?? '',
    categoryId: item.categoryId ?? '',
    notes: item.notes ?? '',
  }),
}
