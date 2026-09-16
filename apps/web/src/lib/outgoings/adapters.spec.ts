import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '$lib/api/categories'
import type { UserSummary } from '$lib/api/users'

vi.mock('$lib/api/recurring-bills', () => ({
  listUpcomingRecurringBills: vi.fn(),
  getRecurringBill: vi.fn(),
  createRecurringBill: vi.fn(),
  updateRecurringBill: vi.fn(),
  deleteRecurringBill: vi.fn(),
  listRecurringBillPayments: vi.fn(),
  getRecurringBillTrend: vi.fn(),
  deleteRecurringBillPayment: vi.fn(),
}))
vi.mock('$lib/api/subscriptions', () => ({
  listSubscriptions: vi.fn(),
  getSubscription: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  listSubscriptionPayments: vi.fn(),
  getSubscriptionTrend: vi.fn(),
  deleteSubscriptionPayment: vi.fn(),
}))
vi.mock('$lib/api/expenses', () => ({
  listExpenses: vi.fn(),
  getExpense: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
}))
vi.mock('$lib/api/expense-actuals', () => ({
  getExpenseTrend: vi.fn(),
}))
vi.mock('$lib/api/utilities', () => ({
  listUtilities: vi.fn(),
  getUtilityTrend: vi.fn(),
  createUtility: vi.fn(),
  updateUtility: vi.fn(),
  deleteUtility: vi.fn(),
}))

import * as billsApi from '$lib/api/recurring-bills'
import * as subsApi from '$lib/api/subscriptions'
import * as expensesApi from '$lib/api/expenses'
import * as actualsApi from '$lib/api/expense-actuals'
import * as utilitiesApi from '$lib/api/utilities'
import { billsAdapter } from './bills'
import { subscriptionsAdapter } from './subscriptions'
import { expensesAdapter } from './expenses'
import { utilitiesAdapter } from './utilities'
import type { OutgoingContext } from './types'

const ctx: OutgoingContext = {
  categories: [
    {
      id: 5,
      name: 'Insurance',
      color: null,
      sortOrder: 0,
      parentId: null,
      isActive: true,
      isArchived: false,
      isSystem: false,
    },
  ] as Category[],
  users: [
    { id: 1, fullName: 'Adam', email: 'a@test.local', displayColor: null, initials: 'A' },
  ] as UserSummary[],
}

const trend = {
  average: 50,
  latestAmount: 60,
  latestYear: 2026,
  latestMonth: 3,
  trend: 'up' as const,
  months: [{ year: 2026, month: 3, amount: 60 }],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('billsAdapter', () => {
  it('maps a form draft to the create payload', async () => {
    vi.mocked(billsApi.createRecurringBill).mockResolvedValue({} as never)

    await billsAdapter.create({
      name: 'Car insurance',
      amount: '600',
      frequency: 'annual',
      nextDueOn: '2026-06-15',
      categoryId: '5',
      notes: '',
    })

    expect(billsApi.createRecurringBill).toHaveBeenCalledWith({
      name: 'Car insurance',
      amount: 600,
      frequency: 'annual',
      nextDueOn: '2026-06-15',
      categoryId: 5,
      notes: null,
    })
  })

  it('maps null-ish values and passes a lifecycle patch straight through', async () => {
    vi.mocked(billsApi.updateRecurringBill).mockResolvedValue({} as never)

    await billsAdapter.update(3, {
      name: 'x',
      amount: 1,
      frequency: 'monthly',
      nextDueOn: '2026-01-01',
      categoryId: '',
      notes: 'hi',
    })
    await billsAdapter.setLifecycle(3, { isPaused: true })

    expect(billsApi.updateRecurringBill).toHaveBeenNthCalledWith(1, 3, {
      name: 'x',
      amount: 1,
      frequency: 'monthly',
      nextDueOn: '2026-01-01',
      categoryId: null,
      notes: 'hi',
    })
    expect(billsApi.updateRecurringBill).toHaveBeenNthCalledWith(2, 3, { isPaused: true })
  })

  it('renders due info, category and stats', () => {
    const bill = {
      id: 1,
      name: 'Car insurance',
      categoryId: 5,
      amount: 600,
      frequency: 'annual' as const,
      dueDay: 15,
      dueMonth: 6,
      dueYear: 2026,
      isActive: true,
      isPaused: false,
      isArchived: false,
      notes: null,
      createdAt: '',
      updatedAt: '',
      nextDueOn: '2026-06-15',
      daysUntilDue: 3,
      dueSoon: true,
    }

    expect(billsAdapter.rowValues(bill, ctx).nextDueOn).toBe('Due in 3 days')
    expect(billsAdapter.rowValues(bill, ctx).amount).toBe('$600.00')
    expect(billsAdapter.subtitle(bill, ctx)).toBe('Annual, Insurance')
    expect(billsAdapter.href(bill)).toBe('/bills/1')
    expect(billsAdapter.anchorId?.(bill)).toBe('bill-1')
    expect(billsAdapter.grouping?.key(bill, ctx)).toBe('annual')
    expect(billsAdapter.stats(bill, trend, ctx)[3]?.value).toBe('$50.00')
    // "Next due" carries a due/over tone (DESIGN.md's status colours) and
    // "Category" carries the category's own colour as a leading dot.
    expect(billsAdapter.stats(bill, trend, ctx)[2]?.tone).toBe('due')
    expect(billsAdapter.stats(bill, trend, ctx)[4]).toEqual({
      label: 'Category',
      value: 'Insurance',
      dot: null,
    })
  })

  it('maps history entries and a bill back to form values', async () => {
    vi.mocked(billsApi.listRecurringBillPayments).mockResolvedValue([
      { id: 9, year: 2026, month: 3, paid: true, amount: 42 } as never,
    ])

    expect(await billsAdapter.history!(1)).toEqual([
      { id: 9, year: 2026, month: 3, paid: true, amount: 42 },
    ])

    expect(
      billsAdapter.toFormValues(
        {
          id: 1,
          name: 'x',
          categoryId: null,
          amount: 5,
          frequency: 'annual',
          dueDay: 15,
          dueMonth: 6,
          dueYear: 2026,
          isActive: true,
          isPaused: false,
          isArchived: false,
          notes: null,
          createdAt: '',
          updatedAt: '',
        },
        ctx
      ).nextDueOn
    ).toBe('2026-06-15')
  })
})

describe('subscriptionsAdapter', () => {
  it('maps a form draft and rows', async () => {
    vi.mocked(subsApi.createSubscription).mockResolvedValue({} as never)

    await subscriptionsAdapter.create({
      userId: '1',
      name: 'Netflix',
      amount: '22.99',
      dayOfMonth: '',
      categoryId: '',
      notes: '',
    })

    expect(subsApi.createSubscription).toHaveBeenCalledWith({
      userId: 1,
      name: 'Netflix',
      amount: 22.99,
      dayOfMonth: null,
      categoryId: null,
      notes: null,
    })

    const sub = {
      id: 2,
      userId: 1,
      name: 'Netflix',
      categoryId: null,
      amount: 22.99,
      dayOfMonth: 4,
      isRecurring: true,
      isActive: true,
      isPaused: false,
      isArchived: false,
      notes: null,
      createdAt: '',
      updatedAt: '',
    }
    expect(subscriptionsAdapter.href(sub)).toBe('/subscriptions/2')
    expect(subscriptionsAdapter.subtitle(sub, ctx)).toBe('Adam')
    expect(subscriptionsAdapter.rowValues(sub, ctx).dayOfMonth).toBe('4')
    const stats = subscriptionsAdapter.stats(sub, trend, ctx)
    expect(stats).toHaveLength(5)
    // The Owner stat carries the person's own displayColor as a dot
    // (DESIGN.md: "Each person's displayColor remains their per-person
    // colour in Income, Subscriptions and charts").
    expect(stats.find((s) => s.label === 'Owner')).toEqual({
      label: 'Owner',
      value: 'Adam',
      dot: null,
    })
  })
})

describe('expensesAdapter', () => {
  it('attaches trends on list', async () => {
    vi.mocked(expensesApi.listExpenses).mockResolvedValue([
      { id: 1, name: 'A', sortOrder: 0 } as never,
      { id: 2, name: 'B', sortOrder: 1 } as never,
      { id: 3, name: 'C', sortOrder: 2 } as never,
    ])
    vi.mocked(actualsApi.getExpenseTrend).mockResolvedValue(trend as never)

    const rows = await expensesAdapter.list({ includeHidden: true })
    expect(rows[0]?.trend).toEqual(trend)
  })

  it('groups by category, resolving the label and order from the lookups', () => {
    const grouping = expensesAdapter.grouping!
    expect(grouping.key({ id: 1, name: 'A', categoryId: 5 } as never, ctx)).toBe('5')
    expect(grouping.key({ id: 2, name: 'B', categoryId: null } as never, ctx)).toBe(
      '__uncategorized'
    )
    // A hidden (archived) category isn't in the lookups, so it folds into the
    // same bucket as a null category rather than a second titled group.
    expect(grouping.key({ id: 3, name: 'C', categoryId: 99 } as never, ctx)).toBe('__uncategorized')
    expect(grouping.label!('5', ctx)).toBe('Insurance')
    expect(grouping.label!('__uncategorized', ctx)).toBe('Uncategorized')
    // `key()` folds unknown ids into UNCATEGORIZED, so this is a guard for if
    // `key`/`order` ever drift rather than a path `OutgoingsList` reaches -
    // assert it directly so the branch stays covered.
    expect(grouping.label!('99', ctx)).toBe('Uncategorized')

    const order = (grouping.order as (context: typeof ctx) => string[])(ctx)
    expect(order).toEqual(['5', '__uncategorized'])
  })

  it('sorts by name by default', () => {
    expect(expensesAdapter.defaultSort).toBe('name')
  })

  it('omits budgetAmount when the expense has itemized items', async () => {
    vi.mocked(expensesApi.updateExpense).mockResolvedValue({} as never)

    await expensesAdapter.update(
      1,
      {
        name: 'A',
        categoryId: '',
        budgetAmount: '80',
        isRecurring: true,
        excludeFromBudget: false,
      },
      { id: 1, name: 'A', isActive: true, budgetItemCount: 2 } as never
    )

    expect(expensesApi.updateExpense).toHaveBeenCalledWith(1, {
      name: 'A',
      categoryId: null,
      isRecurring: true,
      excludeFromBudget: false,
    })
  })
})

describe('utilitiesAdapter', () => {
  it('never exposes a lifecycle and maps settings', async () => {
    vi.mocked(utilitiesApi.updateUtility).mockResolvedValue({} as never)

    await utilitiesAdapter.update(7, {
      frequency: 'quarterly',
      dueOffsetDays: '13',
      dueOffsetBusinessDaysOnly: true,
      paidInAdvance: false,
    })

    expect(utilitiesApi.updateUtility).toHaveBeenCalledWith(7, {
      frequency: 'quarterly',
      dueOffsetDays: 13,
      dueOffsetBusinessDaysOnly: true,
      paidInAdvance: false,
    })
    expect(utilitiesAdapter.supportsLifecycle).toBe(false)
    await expect(utilitiesAdapter.setLifecycle(7, { isPaused: true })).rejects.toThrow()
  })

  it('renders the latest bill and next due from the trend', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'))
    const utility = {
      id: 7,
      name: 'Electricity',
      categoryId: null,
      frequency: 'monthly' as const,
      dueOffsetDays: null,
      dueOffsetBusinessDaysOnly: false,
      paidInAdvance: false,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    }
    const utilityTrend = { ...trend, nextDueOn: '2026-04-03' }
    const utilityRow = { ...utility, trend: utilityTrend }

    expect(utilitiesAdapter.href(utility)).toBe('/utilities/7')
    expect(utilitiesAdapter.rowValues(utilityRow, ctx).latest).toBe('$60.00')
    expect(utilitiesAdapter.rowValues(utilityRow, ctx).nextDueOn).toBe('3 Apr 2026')
    const stats = utilitiesAdapter.stats(utility, utilityTrend, ctx)
    expect(stats[0]?.value).toBe('$60.00')
    // "Next bill due" carries the same due/over status colour as bills.
    expect(stats[2]).toEqual({
      label: 'Next bill due',
      value: '3 Apr 2026',
      hint: 'Due in 2 days',
      tone: 'due',
    })

    vi.useRealTimers()
  })
})

describe('adapter API wiring', () => {
  it('bills: wires every operation to its API module', async () => {
    const bill = { id: 1, name: 'x', categoryId: null, amount: 5, frequency: 'annual', dueDay: 1, dueMonth: 1, dueYear: 2026, isActive: true, isPaused: false, isArchived: false, notes: null, createdAt: '', updatedAt: '' }
    vi.mocked(billsApi.getRecurringBill).mockResolvedValue(bill as never)
    vi.mocked(billsApi.createRecurringBill).mockResolvedValue(bill as never)
    vi.mocked(billsApi.updateRecurringBill).mockResolvedValue(bill as never)
    vi.mocked(billsApi.deleteRecurringBill).mockResolvedValue(undefined as never)
    vi.mocked(billsApi.getRecurringBillTrend).mockResolvedValue(trend as never)
    vi.mocked(billsApi.listRecurringBillPayments).mockResolvedValue([])
    vi.mocked(billsApi.deleteRecurringBillPayment).mockResolvedValue(undefined as never)

    await billsAdapter.get(1)
    await billsAdapter.create({ name: 'x', amount: 1, frequency: 'monthly', nextDueOn: '2026-01-01' })
    await billsAdapter.update(1, { name: 'x', amount: 1, frequency: 'monthly', nextDueOn: '2026-01-01' })
    await billsAdapter.setLifecycle(1, { isActive: false })
    await billsAdapter.remove(1)
    await billsAdapter.trend(1)
    await billsAdapter.history!(1)
    await billsAdapter.deleteHistory!(9)
    billsAdapter.state(bill as never)

    expect(billsApi.deleteRecurringBill).toHaveBeenCalledWith(1)
    expect(billsApi.deleteRecurringBillPayment).toHaveBeenCalledWith(9)
  })

  it('subscriptions: wires every operation to its API module', async () => {
    const sub = { id: 2, userId: 1, name: 'x', categoryId: null, amount: 5, dayOfMonth: null, isRecurring: true, isActive: true, isPaused: false, isArchived: false, notes: null, createdAt: '', updatedAt: '' }
    vi.mocked(subsApi.getSubscription).mockResolvedValue(sub as never)
    vi.mocked(subsApi.createSubscription).mockResolvedValue(sub as never)
    vi.mocked(subsApi.updateSubscription).mockResolvedValue(sub as never)
    vi.mocked(subsApi.deleteSubscription).mockResolvedValue(undefined as never)
    vi.mocked(subsApi.getSubscriptionTrend).mockResolvedValue(trend as never)
    vi.mocked(subsApi.listSubscriptionPayments).mockResolvedValue([])
    vi.mocked(subsApi.deleteSubscriptionPayment).mockResolvedValue(undefined as never)

    await subscriptionsAdapter.get(2)
    await subscriptionsAdapter.create({ userId: 1, name: 'x', amount: 1 })
    await subscriptionsAdapter.update(2, { userId: 1, name: 'x', amount: 1 })
    await subscriptionsAdapter.setLifecycle(2, { isPaused: true })
    await subscriptionsAdapter.remove(2)
    await subscriptionsAdapter.trend(2)
    await subscriptionsAdapter.history!(2)
    await subscriptionsAdapter.deleteHistory!(9)
    subscriptionsAdapter.state(sub)
    subscriptionsAdapter.href(sub as never)
    subscriptionsAdapter.subtitle(sub as never, ctx)
    subscriptionsAdapter.rowValues(sub as never, ctx)
    subscriptionsAdapter.stats(sub as never, trend, ctx)
    subscriptionsAdapter.toFormValues(sub as never, ctx)

    expect(subsApi.deleteSubscription).toHaveBeenCalledWith(2)
    expect(subsApi.deleteSubscriptionPayment).toHaveBeenCalledWith(9)
  })

  it('expenses: wires every operation to its API module', async () => {
    const expense = { id: 3, name: 'x', sortOrder: 0, budgetAmount: null, budgetItemCount: 0, isRecurring: true, excludeFromBudget: false, categoryId: null, isActive: true, isPaused: false, isArchived: false }
    vi.mocked(expensesApi.getExpense).mockResolvedValue(expense as never)
    vi.mocked(expensesApi.createExpense).mockResolvedValue(expense as never)
    vi.mocked(expensesApi.updateExpense).mockResolvedValue(expense as never)
    vi.mocked(expensesApi.deleteExpense).mockResolvedValue(undefined as never)
    vi.mocked(actualsApi.getExpenseTrend).mockResolvedValue(trend as never)

    await expensesAdapter.get(3)
    await expensesAdapter.create({ name: 'x' })
    await expensesAdapter.update(3, { name: 'x' }, { ...expense, trend: null })
    await expensesAdapter.setLifecycle(3, { isArchived: true })
    await expensesAdapter.remove(3)
    await expensesAdapter.trend(3)
    expensesAdapter.state(expense)
    expensesAdapter.href(expense as never)
    expensesAdapter.subtitle(expense as never, ctx)
    expensesAdapter.rowValues({ ...expense, trend: null } as never, ctx)
    expensesAdapter.stats(expense as never, trend, ctx)
    expensesAdapter.toFormValues(expense as never, ctx)
    expensesAdapter.anchorId?.(expense as never)

    expect(expensesApi.deleteExpense).toHaveBeenCalledWith(3)
  })

  it('utilities: wires every operation to its API module', async () => {
    const utility = { id: 7, name: 'x', categoryId: null, frequency: 'monthly' as const, dueOffsetDays: null, dueOffsetBusinessDaysOnly: false, paidInAdvance: false, isActive: true, createdAt: '', updatedAt: '' }
    vi.mocked(utilitiesApi.listUtilities).mockResolvedValue([utility] as never)
    vi.mocked(utilitiesApi.getUtilityTrend).mockResolvedValue(trend as never)
    vi.mocked(utilitiesApi.createUtility).mockResolvedValue(utility as never)
    vi.mocked(utilitiesApi.updateUtility).mockResolvedValue(utility as never)
    vi.mocked(utilitiesApi.deleteUtility).mockResolvedValue(undefined as never)

    await utilitiesAdapter.get(7)
    await utilitiesAdapter.create({ name: 'x' })
    await utilitiesAdapter.update(7, { frequency: 'monthly', dueOffsetDays: '', dueOffsetBusinessDaysOnly: false, paidInAdvance: false })
    await utilitiesAdapter.remove(7)
    await utilitiesAdapter.trend(7)
    utilitiesAdapter.state(utility)
    utilitiesAdapter.href(utility as never)
    utilitiesAdapter.subtitle(utility as never, ctx)
    utilitiesAdapter.rowValues({ ...utility, trend: null } as never, ctx)
    utilitiesAdapter.stats(utility as never, trend, ctx)
    utilitiesAdapter.toFormValues(utility as never, ctx)

    expect(utilitiesApi.deleteUtility).toHaveBeenCalledWith(7)
    await expect(utilitiesAdapter.get(999)).rejects.toThrow('Utility not found')
  })
})
