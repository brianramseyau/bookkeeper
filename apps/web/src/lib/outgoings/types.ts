import type { Category } from '$lib/api/categories'
import type { UserSummary } from '$lib/api/users'
import type { LifecycleFlags, LifecycleState } from '$lib/lifecycle'

/** Lookups the shared components supply so adapters can render names, not ids. */
export interface OutgoingContext {
  categories: Category[]
  users: UserSummary[]
}

export interface OutgoingColumn {
  key: string
  label: string
  align?: 'left' | 'right'
  /** Render in the mono figures role, e.g. a money value. */
  money?: boolean
}

export interface OutgoingFieldOption {
  value: string | number
  label: string
}

/**
 * One choice in a list page's sort control. Omit `compare` to keep the
 * adapter's own list order (the page's default order from `list()`).
 */
export interface OutgoingSortOption<T extends OutgoingRecord> {
  value: string
  label: string
  /** Method syntax (not a property arrow type) so adapters stay assignable to `OutgoingAdapter<OutgoingRecord>` by bivariant parameter checking. */
  compare?(a: T, b: T): number
}

/**
 * List grouping (e.g. bills by frequency, expenses by category). All four
 * fields travel together so an adapter can't declare grouping without the
 * toggle's noun (`byLabel`) - see `OutgoingAdapter.grouping`.
 */
export interface OutgoingGrouping<T extends OutgoingRecord> {
  /** Noun for the toggle's label, e.g. "category" renders "Group by category". */
  byLabel: string
  /** Grouping key for an item, e.g. its frequency or category id. */
  key(item: T): string | null
  /** Display order for keys, fixed or derived from the loaded lookups. */
  order?: string[] | ((ctx: OutgoingContext) => string[])
  /** Label for a key; falls back to the key itself. */
  label?(key: string, ctx: OutgoingContext): string
}

export type OutgoingFieldType =
  'text' | 'number' | 'date' | 'select' | 'category' | 'user' | 'checkbox'

export interface OutgoingField {
  key: string
  label: string
  type: OutgoingFieldType
  options?: OutgoingFieldOption[]
  required?: boolean
  step?: string
  placeholder?: string
  min?: number
  hint?: string
}

/** A form draft - values are what an `<input>`/`<select>` holds, so strings for text/number/date and booleans for checkboxes. */
export type OutgoingFormValues = Record<string, string | number | boolean | null>

export interface OutgoingHistoryEntry {
  id: number
  year: number
  month: number
  paid: boolean
  amount: number | null
}

export interface OutgoingTrendPoint {
  year: number
  month: number
  amount: number
}

export interface OutgoingTrend {
  average: number | null
  latestAmount: number | null
  latestYear: number | null
  latestMonth: number | null
  trend: 'up' | 'down' | 'flat' | null
  months: OutgoingTrendPoint[]
  /** Utilities only - the next computed due date. */
  nextDueOn?: string | null
}

export interface OutgoingStat {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative'
}

/** The minimum every outgoing entity has in common. */
export interface OutgoingRecord {
  id: number
  name: string
  isActive: boolean
  isPaused?: boolean
  isArchived?: boolean
}

export interface OutgoingListOptions {
  includeHidden?: boolean
  userId?: number
}

/**
 * Everything the shared list/detail/form components need to work with one
 * kind of outgoing (bill, subscription, expense, utility) without knowing
 * which kind it is. Adapters live next to each other in `$lib/outgoings/`
 * and wrap that kind's `$lib/api/*` module.
 */
export interface OutgoingAdapter<T extends OutgoingRecord> {
  kind: string
  /** Plural page title, e.g. "Bills". */
  title: string
  /** A one-line "what this page is for" under the title. */
  description: string
  /** Lower-case singular used in copy and toasts, e.g. "Bill". */
  singular: string
  emptyMessage: string
  supportsLifecycle: boolean
  /** Optional list grouping. Its presence enables the mobile/desktop grouping toggle. */
  grouping?: OutgoingGrouping<T>
  /** Whether the detail page renders a payment history table. */
  hasHistory: boolean
  /** Sort choices for the list; the first (`defaultSort`) is selected initially. */
  sorts?: OutgoingSortOption<T>[]
  defaultSort?: string
  columns: OutgoingColumn[]
  /** Fields the add/edit form renders. */
  fields: OutgoingField[]
  /** Overrides `fields` when editing (e.g. a utility's add is name-only, its edit is billing settings). */
  editFields?: OutgoingField[]
  /** Like `editFields`, but computed per item - e.g. a budget owned by itemized lines is dropped from the form entirely. */
  editFieldsFor?(item: T): OutgoingField[]

  list(opts?: OutgoingListOptions): Promise<T[]>
  get(id: number): Promise<T>
  /** Both take the raw form draft; each adapter maps it to its own API body. */
  create(values: OutgoingFormValues): Promise<T>
  update(id: number, values: OutgoingFormValues, item?: T): Promise<T>
  /** A direct lifecycle PATCH (pause/archive/restore), bypassing the form mapping. */
  setLifecycle(id: number, patch: Partial<LifecycleFlags>): Promise<T>
  remove(id: number): Promise<void>
  history?(id: number): Promise<OutgoingHistoryEntry[]>
  deleteHistory?(id: number): Promise<void>
  trend(id: number): Promise<OutgoingTrend>

  href(item: T): string
  subtitle(item: T, ctx: OutgoingContext): string
  state(item: T): LifecycleState
  /** DOM id for a row, so a `#bill-12` deep link can scroll/flash it (see the Monthly page's cross-links). */
  anchorId?(item: T): string | null
  rowValues(item: T, ctx: OutgoingContext): Record<string, string>
  stats(item: T, trend: OutgoingTrend, ctx: OutgoingContext): OutgoingStat[]
  /** Prefill for the edit form. */
  toFormValues(item: T, ctx: OutgoingContext): OutgoingFormValues
}
