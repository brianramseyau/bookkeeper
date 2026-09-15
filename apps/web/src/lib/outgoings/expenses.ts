import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
  type Expense,
} from '$lib/api/expenses'
import { getExpenseTrend, type ExpenseTrend } from '$lib/api/expense-actuals'
import { formatCurrency } from '$lib/format'
import { lifecycleState } from '$lib/lifecycle'
import { reorderedSortOrders } from '$lib/dnd'
import type { OutgoingAdapter, OutgoingFormValues, OutgoingTrend } from './types'

/** An expense plus the trailing trend the list attaches, for latest/average columns. */
export interface ExpenseRow extends Expense {
  trend?: ExpenseTrend | null
}

function toExpenseInput(values: OutgoingFormValues, item?: ExpenseRow) {
  const input: Record<string, unknown> = {
    name: values.name,
    categoryId:
      values.categoryId === '' || values.categoryId === null ? null : Number(values.categoryId),
    isRecurring: Boolean(values.isRecurring),
    excludeFromBudget: Boolean(values.excludeFromBudget),
  }
  // A budget with itemized lines owns its amount - the API derives it from
  // the items, so the edit form must not stomp it (see ExpensesController's
  // budget-item sync).
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
  supportsGrouping: false,
  supportsReorder: true,
  hasHistory: false,
  columns: [
    { key: 'budget', label: 'Budget', align: 'right', money: true },
    { key: 'latest', label: 'Latest', align: 'right', money: true },
    { key: 'average', label: '12-month average', align: 'right', money: true },
    { key: 'category', label: 'Category' },
  ],
  fields: [
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
  ],

  async list(opts) {
    const expenses = await listExpenses({ includeHidden: opts?.includeHidden })
    const trends = await Promise.all(
      expenses.map((expense) => getExpenseTrend(expense.id).catch(() => null))
    )
    return expenses.map((expense, index) => ({ ...expense, trend: trends[index] ?? null }))
  },
  get: (id) => getExpense(id),
  create: (values) => createExpense(toExpenseInput(values) as never),
  update: (id, values, item) => updateExpense(id, toExpenseInput(values, item) as never),
  setLifecycle: (id, patch) => updateExpense(id, patch as never),
  remove: (id) => deleteExpense(id),
  trend: (id) => getExpenseTrend(id) as Promise<OutgoingTrend>,
  async reorder(items) {
    const changes = reorderedSortOrders(items)
    await Promise.all(
      changes.map((change) => updateExpense(change.id, { sortOrder: change.sortOrder }))
    )
  },

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
