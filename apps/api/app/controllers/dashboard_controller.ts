import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Category from '#models/category'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'
import UserSubscription from '#models/user_subscription'
import Expense from '#models/expense'
import ExpenseMonthlyActual from '#models/expense_monthly_actual'
import { StandardMonthService } from '#services/standard_month_service'
import { expandUtilityBillsToMonthlyShares } from '#services/utility_billing_period'
import {
  compareByDaysUntilDue,
  isRecurringBillDueMonth,
  nextRecurringBillDueDate,
} from '#services/recurring_bill_due_date'

const UPCOMING_BILLS_LIMIT = 5
const MONTHLY_EXPENSE_WINDOW = 12

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export default class DashboardController {
  async summary({ request, response }: HttpContext) {
    const today = DateTime.local()
    // The viewed month drives the net tile, category breakdown, and the
    // trailing monthlyExpenses window - upcomingBills stays pinned to the
    // real today regardless, since "next due" only means something relative
    // to now.
    const year = request.input('year') ? Number(request.input('year')) : today.year
    const month = request.input('month') ? Number(request.input('month')) : today.month
    const viewed = DateTime.local(year, month, 1)

    const [monthResult, upcomingBills, monthlyExpenses, categoryBreakdown] = await Promise.all([
      new StandardMonthService().compute(year, month),
      this.upcomingBills(),
      this.monthlyExpenses(viewed),
      this.categoryBreakdown(viewed),
    ])

    return response.json({
      currentMonth: {
        year,
        month,
        projectedNet: monthResult.projectedNet,
        actualNet: monthResult.actualNet,
      },
      upcomingBills,
      monthlyExpenses,
      categoryBreakdown,
    })
  }

  private async upcomingBills() {
    const bills = await RecurringBill.query().where('isActive', true).whereNotNull('dueDay')

    const todayStart = DateTime.utc().startOf('day')
    const billIds = bills.map((bill) => bill.id)
    const paidPayments = billIds.length
      ? await RecurringBillPayment.query().whereIn('recurringBillId', billIds).where('paid', true)
      : []
    const paidPeriods = new Set(
      paidPayments.map((payment) => `${payment.recurringBillId}-${payment.year}-${payment.month}`)
    )

    return bills
      .map((bill) => {
        // whereNotNull('dueDay') above guarantees nextRecurringBillDueDate
        // returns non-null here too. Occurrences already marked paid are
        // skipped so "next due" reflects what's still owed, not the bill's
        // raw calendar cycle - bounded to a few years out so a bill paid
        // indefinitely ahead can't spin forever.
        let cursor: DateTime<boolean> = todayStart
        let nextOccurrence = nextRecurringBillDueDate(
          bill.frequency,
          bill.dueDay,
          bill.dueMonth,
          cursor
        )!
        let guard = 0
        while (
          paidPeriods.has(`${bill.id}-${nextOccurrence.year}-${nextOccurrence.month}`) &&
          guard < 36
        ) {
          cursor = nextOccurrence.plus({ days: 1 })
          nextOccurrence = nextRecurringBillDueDate(
            bill.frequency,
            bill.dueDay,
            bill.dueMonth,
            cursor
          )!
          guard += 1
        }
        return {
          id: bill.id,
          name: bill.name,
          amount: bill.amount,
          nextDueOn: nextOccurrence.toISODate(),
          daysUntilDue: Math.floor(nextOccurrence.diff(todayStart, 'days').days),
        }
      })
      .sort((a, b) => compareByDaysUntilDue(a.daysUntilDue, b.daysUntilDue))
      .slice(0, UPCOMING_BILLS_LIMIT)
  }

  /**
   * Total actual spend per month for the trailing window ending at the
   * viewed month - utility bills and expense actuals are the two tables
   * with real per-month historical depth (recurring bills/subscriptions
   * only carry a current snapshot amount, not a monthly log, so they're
   * left out to avoid implying a false history).
   */
  private async monthlyExpenses(viewed: DateTime) {
    const start = viewed.startOf('month').minus({ months: MONTHLY_EXPENSE_WINDOW - 1 })

    const ignoredExpenses = await Expense.query().where('excludeFromBudget', true).select('id')
    const ignoredExpenseIds = ignoredExpenses.map((expense) => expense.id)

    const [utilityBills, expenseActuals] = await Promise.all([
      UtilityBill.query().preload('utility'),
      // Actuals belonging to an ignored expense (e.g. Credit Card, whose
      // spend already shows up under other expenses) are left out here too,
      // not just on the Monthly page - otherwise the trend chart double-
      // counts the same spend.
      ignoredExpenseIds.length
        ? ExpenseMonthlyActual.query().whereNotIn('expenseId', ignoredExpenseIds)
        : ExpenseMonthlyActual.query(),
    ])

    const totals = new Map<string, number>()
    const addTotal = (year: number, month: number, amount: number) => {
      const key = `${year}-${month}`
      totals.set(key, (totals.get(key) ?? 0) + amount)
    }

    for (const bill of utilityBills) {
      for (const share of expandUtilityBillsToMonthlyShares([bill], bill.utility.frequency)) {
        addTotal(share.year, share.month, share.amount)
      }
    }
    for (const actual of expenseActuals) {
      addTotal(actual.occurredOn.year, actual.occurredOn.month, actual.amount)
    }

    const months: { year: number; month: number; total: number }[] = []
    for (let i = 0; i < MONTHLY_EXPENSE_WINDOW; i++) {
      const cursor = start.plus({ months: i })
      months.push({
        year: cursor.year,
        month: cursor.month,
        total: round(totals.get(`${cursor.year}-${cursor.month}`) ?? 0),
      })
    }

    return months
  }

  /**
   * The viewed month's actual spend grouped by category - utility bills and
   * expense actuals are the tables with real per-month depth; recurring
   * bills and subscriptions only carry a current snapshot amount (no
   * monthly log), but unlike the monthlyExpenses trend this is a single
   * month, and the standard month's net figures already count them, so
   * they're included here too rather than silently missing from "spend by
   * category". Utility bills all carry the system "Utilities" category (see
   * UtilitiesController#store), so their spend rolls up under it here
   * rather than getting a separate utilities section.
   */
  private async categoryBreakdown(viewed: DateTime) {
    const ignoredExpenses = await Expense.query().where('excludeFromBudget', true).select('id')
    const ignoredExpenseIds = ignoredExpenses.map((expense) => expense.id)

    const [utilityBills, expenseActuals, recurringBills, subscriptions, categories] =
      await Promise.all([
        UtilityBill.query().preload('utility'),
        ignoredExpenseIds.length
          ? ExpenseMonthlyActual.query()
              .preload('expense')
              .whereNotIn('expenseId', ignoredExpenseIds)
          : ExpenseMonthlyActual.query().preload('expense'),
        RecurringBill.query().where('isActive', true).andWhere('isArchived', false),
        UserSubscription.query()
          .where('isActive', true)
          .andWhere('isPaused', false)
          .andWhere('isArchived', false)
          .andWhere('isRecurring', true),
        Category.query(),
      ])

    const totals = new Map<number, number>()
    const addTotal = (categoryId: number | null, amount: number) => {
      if (categoryId === null) return
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + amount)
    }

    for (const bill of utilityBills) {
      for (const share of expandUtilityBillsToMonthlyShares([bill], bill.utility.frequency)) {
        if (share.year === viewed.year && share.month === viewed.month) {
          addTotal(bill.utility.categoryId, share.amount)
        }
      }
    }
    for (const actual of expenseActuals) {
      if (actual.occurredOn.year === viewed.year && actual.occurredOn.month === viewed.month) {
        addTotal(actual.expense.categoryId, actual.amount)
      }
    }

    const dueRecurringBills = recurringBills.filter((bill) =>
      isRecurringBillDueMonth(bill.frequency, bill.dueMonth, viewed.month)
    )
    const dueRecurringBillIds = dueRecurringBills.map((bill) => bill.id)
    const recurringBillPayments = dueRecurringBillIds.length
      ? await RecurringBillPayment.query()
          .whereIn('recurringBillId', dueRecurringBillIds)
          .where('year', viewed.year)
          .where('month', viewed.month)
      : []
    const recurringBillPaymentById = new Map(
      recurringBillPayments.map((payment) => [payment.recurringBillId, payment])
    )
    for (const bill of dueRecurringBills) {
      const payment = recurringBillPaymentById.get(bill.id)
      addTotal(bill.categoryId, payment?.amount ?? bill.amount)
    }

    for (const subscription of subscriptions) {
      addTotal(subscription.categoryId, subscription.amount)
    }

    const categoriesById = new Map(categories.map((category) => [category.id, category]))

    return Array.from(totals.entries())
      .map(([categoryId, total]) => {
        const category = categoriesById.get(categoryId)!
        return {
          id: category.id,
          name: category.name,
          color: category.color,
          total: round(total),
        }
      })
      .sort((a, b) => b.total - a.total)
  }
}
