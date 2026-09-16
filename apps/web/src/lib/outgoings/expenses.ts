import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
  type Expense,
  type ExpenseInput,
} from '$lib/api/expenses'
import { getExpenseTrend, type ExpenseTrend } from '$lib/api/expense-actuals'
import { formatCurrency } from '$lib/format'
import { lifecycleState } from '$lib/lifecycle'
import { byName, byValueDesc } from './sort'
import type {
  OutgoingAdapter,
  OutgoingField,
  OutgoingFormValues,
  OutgoingTrend,
} from './types'

/** An expense plus the trailing trend the list attaches, for latest/average columns. */
export interface ExpenseRow extends Expense {
  trend?: ExpenseTrend | null
}

/** Group key for an expense with no category (never a real category id). */
const UNCATEGORIZED = '__uncategorized'

const EXPENSE_FIELDS: OutgoingField[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Groceries' },
  { key: 'categoryId', label: 'Category', type: 'category' },
  { key: 'budgetAmount', label: 'Budget amount', type: 'number', step: '0.01', min: 0 },
  { key: 'isRecurring', label: 'Recurring', type: 'checkbox' },
  {
    key: 'excludeFromBudget',
    label: 'Exclude from Monthly',
    type: 'checkbox',
    hint: 'Use for an expense whose spend already shows under another category, like a credit card.',
  },
]

function toExpenseInput(values: OutgoingFormValues, item?: ExpenseRow): ExpenseInput {
  const input: ExpenseInput = {
    name: String(values.name ?? ''),
    categoryId:
      values.categoryId === '' || values.categoryId === null ? null : Number(values.categoryId),
    isRecurring: Boolean(values.isRecurring),
    excludeFromBudget: Boolean(values.excludeFromBudget),
  }
  // A budget with itemized lines owns its amount - the API derives it from
  // the items (see ExpensesController's budget-item sync), and the edit form
  // drops the field entirely for those, so don't send it.
  if (!item || item.budgetItemCount === 0) {
    input.budgetAmount =
      values.budgetAmount === '' || values.budgetAmount === null
        ? null
        : Number(values.budgetAmount)
  }
  return input
}

export const expensesAdapter: OutgoingAdapter<ExpenseRow> = {
  kind: 'expenses',
  title: 'Expenses',
  description: 'Ongoing spending tracked against a budget.',
  singular: 'Expense',
  emptyMessage: 'No expenses yet. Add the first one to start tracking spend.',
  supportsLifecycle: true,
  grouping: {
    byLabel: 'category',
    // An expense whose category is hidden (archived/soft-deleted) isn't in the
    // loaded categories, and the row shows "Uncategorized" for it anyway - so
    // fold it into the same single bucket rather than emitting a second,
    // differently-titled group per hidden category.
    key: (item, ctx) =>
      item.categoryId === null || !ctx.categories.some((category) => category.id === item.categoryId)
        ? UNCATEGORIZED
        : String(item.categoryId),
    order: (ctx) => [...ctx.categories.map((category) => String(category.id)), UNCATEGORIZED],
    label: (key, ctx) =>
      key === UNCATEGORIZED
        ? 'Uncategorized'
        : (ctx.categories.find((category) => String(category.id) === key)?.name ?? 'Uncategorized'),
  },
  hasHistory: false,
  sorts: [
    { value: 'name', label: 'Name (A-Z)', compare: byName },
    {
      value: 'budget',
      label: 'Budget (high to low)',
      compare: byValueDesc((item) => item.budgetAmount),
    },
    {
      value: 'latest',
      label: 'Latest (high to low)',
      compare: byValueDesc((item) => item.trend?.latestAmount),
    },
    {
      value: 'average',
      label: '12-month average (high to low)',
      compare: byValueDesc((item) => item.trend?.average),
    },
  ],
  defaultSort: 'name',
  columns: [
    { key: 'budget', label: 'Budget', align: 'right', money: true },
    { key: 'latest', label: 'Latest', align: 'right', money: true },
    { key: 'average', label: '12-month average', align: 'right', money: true },
    { key: 'category', label: 'Category' },
  ],
  fields: EXPENSE_FIELDS,
  // An expense with itemized budget lines derives its budget from them, so
  // the manual amount field would be silently discarded on save - drop it
  // rather than accept input that goes nowhere.
  editFieldsFor: (item) =>
    item.budgetItemCount > 0
      ? EXPENSE_FIELDS.filter((field) => field.key !== 'budgetAmount')
      : EXPENSE_FIELDS,

  async list(opts) {
    const expenses = await listExpenses({ includeHidden: opts?.includeHidden })
    const trends = await Promise.all(
      expenses.map((expense) => getExpenseTrend(expense.id).catch(() => null))
    )
    return expenses.map((expense, index) => ({ ...expense, trend: trends[index] ?? null }))
  },
  get: (id) => getExpense(id),
  create: (values) => createExpense(toExpenseInput(values)),
  update: (id, values, item) => updateExpense(id, toExpenseInput(values, item)),
  setLifecycle: (id, patch) => updateExpense(id, patch),
  remove: (id) => deleteExpense(id),
  trend: (id) => getExpenseTrend(id) as Promise<OutgoingTrend>,

  href: (item) => `/expenses/${item.id}`,
  subtitle: (item, ctx) =>
    [
      item.isRecurring ? 'Recurring' : 'One-off',
      ctx.categories.find((c) => c.id === item.categoryId)?.name,
    ]
      .filter(Boolean)
      .join(', '),
  state: (item) => lifecycleState(item),
  anchorId: (item) => `expense-${item.id}`,
  rowValues: (item, ctx) => ({
    budget: formatCurrency(item.budgetAmount),
    latest: formatCurrency(item.trend?.latestAmount ?? null),
    average: formatCurrency(item.trend?.average ?? null),
    category: ctx.categories.find((c) => c.id === item.categoryId)?.name ?? 'Uncategorized',
  }),
  stats: (item, trend, ctx) => [
    { label: 'Budget', value: formatCurrency(item.budgetAmount) },
    {
      label: 'Category',
      value: ctx.categories.find((c) => c.id === item.categoryId)?.name ?? 'Uncategorized',
    },
    { label: 'Latest', value: formatCurrency(trend.latestAmount) },
    { label: '12-month average', value: formatCurrency(trend.average) },
  ],
  toFormValues: (item) => ({
    name: item.name,
    categoryId: item.categoryId ?? '',
    budgetAmount: item.budgetAmount ?? '',
    isRecurring: item.isRecurring,
    excludeFromBudget: item.excludeFromBudget,
  }),
}
