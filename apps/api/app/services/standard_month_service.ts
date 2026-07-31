import { DateTime } from 'luxon'
import User from '#models/user'
import MonthCarryover from '#models/month_carryover'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'
import UserSubscription from '#models/user_subscription'
import SubscriptionPayment from '#models/subscription_payment'
import Category from '#models/category'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import CategoryPayment from '#models/category_payment'
import { RollingAverageService } from '#services/rolling_average_service'
import { isUtilityBillingMonth, utilityDueDateFor } from '#services/utility_billing_period'
import { isRecurringBillDueMonth } from '#services/recurring_bill_due_date'
import { computeIncomeLines, type IncomeLine } from '#services/income_lines'

export interface StandardMonthLine {
  key: string
  label: string
  projected: number
  /** null = not tracked for this specific month (e.g. a future utility bill not entered yet). */
  actual: number | null
  dueDay: number | null
  /** Full due date (utilities only) - offset from month-end rather than a fixed day-of-month. */
  dueDate: string | null
  /** Whether the money has actually left the account, independent of whether the amount is known. */
  paid: boolean
  /** Whether the amount itself can be edited here (vs. only its paid state). */
  editable: boolean
}

export type StandardMonthIncomeLine = IncomeLine

export interface StandardMonthResult {
  year: number
  month: number
  /**
   * Cash already sitting in the account on day 1 of the month - not
   * income, and not derivable from tracked income/expenses (spending
   * isn't logged to the last dollar), so this is a manually entered
   * figure rather than anything computed.
   */
  carryover: number
  income: {
    lines: StandardMonthIncomeLine[]
    projectedTotal: number
    actualTotal: number
  }
  expenses: {
    lines: StandardMonthLine[]
    projectedTotal: number
    actualTotal: number
  }
  projectedNet: number
  actualNet: number
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Aggregates a "standard month" picture - the live equivalent of the old
 * workbook's Rolling + Monthly sheets: what's projected to come in/out
 * based on rolling averages and configured amounts, and what's actually
 * happened so far for a given year/month.
 */
export class StandardMonthService {
  private rollingAverage = new RollingAverageService()

  async compute(year: number, month: number): Promise<StandardMonthResult> {
    const [carryover, income, expenseLines] = await Promise.all([
      this.computeCarryover(year, month),
      computeIncomeLines(year, month),
      this.computeExpenseLines(year, month),
    ])

    const expensesProjectedTotal = round(
      expenseLines.reduce((sum, line) => sum + line.projected, 0)
    )
    const expensesActualTotal = round(
      expenseLines.reduce((sum, line) => sum + (line.actual ?? 0), 0)
    )

    return {
      year,
      month,
      carryover,
      income,
      expenses: {
        lines: expenseLines,
        projectedTotal: expensesProjectedTotal,
        actualTotal: expensesActualTotal,
      },
      projectedNet: round(carryover + income.projectedTotal - expensesProjectedTotal),
      actualNet: round(carryover + income.actualTotal - expensesActualTotal),
    }
  }

  private async computeCarryover(year: number, month: number): Promise<number> {
    const carryover = await MonthCarryover.query().where('year', year).where('month', month).first()
    return carryover?.amount ?? 0
  }

  private async computeExpenseLines(year: number, month: number): Promise<StandardMonthLine[]> {
    const lines: StandardMonthLine[] = []

    // Recurring bills and subscriptions only get a payment row once someone
    // actually ticks the checkbox - absence of one for a month that's
    // already gone by just means nobody bothered, not that it's unpaid, so
    // it defaults to paid rather than nagging about bills from three months
    // ago forever. The current/future month still defaults to unpaid, since
    // that's the one point where the reminder is actually useful. Utility
    // bills aren't included in this: their `paid` column is set explicitly
    // the moment the bill itself is entered, so there's no "no row yet"
    // state to default - see the one-time backfill migration for how their
    // pre-feature history was handled instead.
    const today = DateTime.utc()
    const isPastMonth = year < today.year || (year === today.year && month < today.month)

    const utilities = await Utility.query().where('isActive', true).orderBy('name', 'asc')
    for (const utility of utilities) {
      const bills = await UtilityBill.query().where('utilityId', utility.id)

      // A non-monthly utility (e.g. a quarterly Water bill) is only ever
      // actually due once per period - showing it in every month it's
      // amortized over would make it look like money leaves the account
      // monthly when it doesn't. Only the month payment is actually (or
      // predicted to be) due gets a line at all.
      if (!isUtilityBillingMonth(utility, bills, year, month)) continue

      const monthBill = bills.find((bill) => bill.year === year && bill.month === month)

      // Nothing to show for this specific month - no recorded amount, and
      // no live billing obligation either - so a monthly utility with a
      // data gap doesn't clutter every unrelated month with an empty
      // placeholder row. A past month with no data is dead history, not
      // something worth surfacing; the current/future month is kept even
      // without a recorded amount yet, since that's a live reminder rather
      // than stale noise.
      if (!monthBill && isPastMonth) continue

      const billTrend = this.rollingAverage.computeTrend(
        bills.map((bill) => ({ year: bill.year, month: bill.month, amount: bill.amount }))
      )

      lines.push({
        key: `utility-${utility.id}`,
        label: utility.name,
        projected: billTrend.average ?? 0,
        actual: monthBill ? round(monthBill.amount) : null,
        dueDay: null,
        dueDate: utilityDueDateFor(utility, bills, year, month)?.toISO() ?? null,
        paid: monthBill?.paid ?? false,
        editable: true,
      })
    }

    const recurringBills = await RecurringBill.query()
      .where('isActive', true)
      .andWhere('isPaused', false)
      .andWhere('isArchived', false)
      .orderBy('name', 'asc')
    const billIds = recurringBills.map((bill) => bill.id)
    const recurringBillPayments = billIds.length
      ? await RecurringBillPayment.query()
          .whereIn('recurringBillId', billIds)
          .where('year', year)
          .where('month', month)
      : []
    const recurringBillPaymentById = new Map(
      recurringBillPayments.map((payment) => [payment.recurringBillId, payment])
    )

    for (const bill of recurringBills) {
      // A non-monthly bill (e.g. an annual Council Rates bill) is only ever
      // actually due once per cycle - only the month it's actually due in
      // gets a line at all, at its full amount, the same way a non-monthly
      // utility only shows up in its billing month (see isUtilityBillingMonth
      // above).
      if (!isRecurringBillDueMonth(bill.frequency, bill.dueMonth, month)) continue

      const payment = recurringBillPaymentById.get(bill.id)
      const isNonMonthly = bill.frequency !== 'monthly'

      lines.push({
        key: `recurring-bill-${bill.id}`,
        label: isNonMonthly ? `${bill.name} (Bill)` : bill.name,
        projected: bill.amount,
        actual: payment?.amount ?? bill.amount,
        dueDay: bill.dueDay,
        dueDate: null,
        paid: payment?.paid ?? isPastMonth,
        editable: true,
      })
    }

    const users = await User.query().orderBy('fullName', 'asc')
    const subscriptions = await UserSubscription.query()
      .where('isActive', true)
      .andWhere('isPaused', false)
      .andWhere('isArchived', false)
      .where('includeInStandardMonth', true)
      .orderBy('name', 'asc')
    const subscriptionIds = subscriptions.map((sub) => sub.id)
    const subscriptionPayments = subscriptionIds.length
      ? await SubscriptionPayment.query()
          .whereIn('userSubscriptionId', subscriptionIds)
          .where('year', year)
          .where('month', month)
      : []
    const subscriptionPaidById = new Map(
      subscriptionPayments.map((payment) => [payment.userSubscriptionId, payment.paid])
    )

    for (const user of users) {
      const userSubscriptions = subscriptions.filter((sub) => sub.userId === user.id)
      for (const sub of userSubscriptions) {
        lines.push({
          key: `subscription-${sub.id}`,
          label: `${sub.name} (${user.fullName ?? user.email})`,
          projected: sub.amount,
          actual: sub.amount,
          dueDay: sub.dayOfMonth,
          dueDate: null,
          paid: subscriptionPaidById.get(sub.id) ?? isPastMonth,
          editable: true,
        })
      }
    }

    const categories = await Category.query()
      .where('isActive', true)
      .andWhere('isPaused', false)
      .andWhere('isArchived', false)
      .where('includeInStandardMonth', true)
      .orderBy('sortOrder', 'asc')
    const categoryIds = categories.map((category) => category.id)
    const categoryPayments = categoryIds.length
      ? await CategoryPayment.query()
          .whereIn('categoryId', categoryIds)
          .where('year', year)
          .where('month', month)
      : []
    const categoryPaidById = new Map(
      categoryPayments.map((payment) => [payment.categoryId, payment.paid])
    )
    for (const category of categories) {
      const actuals = await CategoryMonthlyActual.query().where('categoryId', category.id)
      if (actuals.length === 0 && category.budgetAmount === null) continue

      const trend = this.rollingAverage.computeTrend(
        actuals.map((actual) => ({
          year: actual.occurredOn.year,
          month: actual.occurredOn.month,
          amount: actual.amount,
        }))
      )
      const thisMonthActuals = actuals.filter(
        (actual) => actual.occurredOn.year === year && actual.occurredOn.month === month
      )

      lines.push({
        key: `category-${category.id}`,
        label: category.name,
        // The `?? 0` fallback can only fire when budgetAmount is null AND
        // trend.average is null, but the guard above (actuals.length === 0
        // && budgetAmount === null -> continue) already excludes exactly
        // that case, so one of the two is always set by this point.
        /* c8 ignore next */
        projected: category.budgetAmount ?? trend.average ?? 0,
        actual:
          thisMonthActuals.length > 0
            ? round(thisMonthActuals.reduce((sum, actual) => sum + actual.amount, 0))
            : null,
        dueDay: null,
        dueDate: null,
        // Same past-month-defaults-to-paid rule as recurring bills/subscriptions
        // above - only meaningful once there's an actual to reconcile against,
        // since the checkbox itself is hidden while `actual` is null.
        paid: categoryPaidById.get(category.id) ?? isPastMonth,
        editable: true,
      })
    }

    return lines
  }
}
