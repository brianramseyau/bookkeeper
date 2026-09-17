import {
  createUtility,
  deleteUtility,
  getUtilityTrend,
  listUtilities,
  updateUtility,
  type Utility,
  type UtilityFrequency,
  type UtilityTrend,
} from '$lib/api/utilities'
import { ApiError } from '$lib/api'
import { daysUntil, dueDateTone, formatCurrency, formatDate, formatDaysUntilDue } from '$lib/format'
import { lifecycleState } from '$lib/lifecycle'
import { byName, byValueAsc, byValueDesc } from './sort'
import type { OutgoingAdapter, OutgoingFormValues, OutgoingTrend } from './types'

/** A utility plus the trailing trend the list attaches, for latest/average columns. */
export interface UtilityRow extends Utility {
  trend?: UtilityTrend | null
}

export const UTILITY_FREQUENCIES: { value: UtilityFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Biannual' },
  { value: 'annual', label: 'Annual' },
]

export function utilityFrequencyLabel(frequency: string): string {
  return UTILITY_FREQUENCIES.find((f) => f.value === frequency)?.label ?? frequency
}

function toUtilitySettings(values: OutgoingFormValues) {
  return {
    frequency: values.frequency as UtilityFrequency,
    dueOffsetDays:
      values.dueOffsetDays === '' || values.dueOffsetDays === null
        ? null
        : Number(values.dueOffsetDays),
    dueOffsetBusinessDaysOnly: Boolean(values.dueOffsetBusinessDaysOnly),
    paidInAdvance: Boolean(values.paidInAdvance),
  }
}

export const utilitiesAdapter: OutgoingAdapter<UtilityRow> = {
  kind: 'utilities',
  title: 'Utilities',
  description: 'Utility bills, their 12-month average and next due date.',
  singular: 'Utility',
  emptyMessage: 'No utilities yet. Add the first one to start tracking bills.',
  // Utilities only have isActive, so there is no pause/archive lifecycle to
  // show (see PLAN_01_PHASE_03_UNIFIED_OUTGOINGS.md - adding one would need a
  // migration).
  supportsLifecycle: false,
  grouping: {
    byLabel: 'frequency',
    key: (item) => item.frequency,
    order: UTILITY_FREQUENCIES.map((frequency) => frequency.value),
    label: (key) => utilityFrequencyLabel(key),
  },
  hasHistory: false,
  sorts: [
    { value: 'name', label: 'Name (A-Z)', compare: byName },
    {
      value: 'latest',
      label: 'Latest bill (high to low)',
      compare: byValueDesc((item) => item.trend?.latestAmount),
    },
    {
      value: 'average',
      label: '12-month average (high to low)',
      compare: byValueDesc((item) => item.trend?.average),
    },
    {
      value: 'nextDue',
      label: 'Next due',
      compare: byValueAsc((item) => item.trend?.nextDueOn),
    },
  ],
  defaultSort: 'name',
  columns: [
    { key: 'latest', label: 'Latest bill', align: 'right', money: true },
    { key: 'average', label: '12-month average', align: 'right', money: true },
    { key: 'frequency', label: 'Frequency' },
    { key: 'nextDueOn', label: 'Next due', align: 'right' },
  ],
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Electricity' },
  ],
  editFields: [
    {
      key: 'frequency',
      label: 'Billing frequency',
      type: 'select',
      required: true,
      options: UTILITY_FREQUENCIES,
    },
    {
      key: 'dueOffsetDays',
      label: 'Due after (days)',
      type: 'number',
      min: 0,
      hint: 'How many days after the bill arrives payment is due. Leave blank if unknown.',
    },
    {
      key: 'dueOffsetBusinessDaysOnly',
      label: 'Count business days only',
      type: 'checkbox',
    },
    {
      key: 'paidInAdvance',
      label: 'Billed in advance',
      type: 'checkbox',
      hint: 'On means the bill covers the months after its date; off means it covers the months before.',
    },
  ],

  async list() {
    const utilities = await listUtilities()
    const trends = await Promise.all(
      utilities.map((utility) => getUtilityTrend(utility.id).catch(() => null))
    )
    return utilities.map((utility, index) => ({ ...utility, trend: trends[index] ?? null }))
  },
  async get(id) {
    const utilities = await listUtilities()
    const utility = utilities.find((u) => u.id === id)
    if (!utility) throw new ApiError(404, 'Utility not found')
    return utility
  },
  create: (values) => createUtility(String(values.name)),
  update: (id, values) => updateUtility(id, toUtilitySettings(values)),
  setLifecycle: async () => {
    throw new Error('Utilities have no pause/archive lifecycle')
  },
  remove: (id) => deleteUtility(id),
  trend: (id) => getUtilityTrend(id) as Promise<OutgoingTrend>,

  href: (item) => `/utilities/${item.id}`,
  subtitle: (item) => utilityFrequencyLabel(item.frequency),
  state: (item) => lifecycleState(item),
  rowValues: (item) => ({
    latest: formatCurrency(item.trend?.latestAmount ?? null),
    average: formatCurrency(item.trend?.average ?? null),
    frequency: utilityFrequencyLabel(item.frequency),
    nextDueOn: formatDate(item.trend?.nextDueOn ?? null),
  }),
  stats: (item, trend) => {
    const daysUntilDue = trend.nextDueOn ? daysUntil(trend.nextDueOn) : null
    return [
      { label: 'Latest bill', value: formatCurrency(trend.latestAmount) },
      { label: 'Frequency', value: utilityFrequencyLabel(item.frequency) },
      {
        label: 'Next bill due',
        value: formatDate(trend.nextDueOn ?? null),
        hint: daysUntilDue !== null ? formatDaysUntilDue(daysUntilDue) : undefined,
        tone: dueDateTone(daysUntilDue),
      },
      { label: '12-month average', value: formatCurrency(trend.average) },
    ]
  },
  toFormValues: (item) => ({
    name: item.name,
    frequency: item.frequency,
    dueOffsetDays: item.dueOffsetDays ?? '',
    dueOffsetBusinessDaysOnly: item.dueOffsetBusinessDaysOnly,
    paidInAdvance: item.paidInAdvance,
  }),
}
