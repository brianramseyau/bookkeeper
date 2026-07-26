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
import { RollingAverageService } from '#services/rolling_average_service'
import {
  expandUtilityBillsToMonthlyShares,
  isUtilityBillingMonth,
  mostRecentUtilityBill,
  utilityPeriodMonths,
} from '#services/utility_billing_period'
import { computeIncomeLines, type IncomeLine } from '#services/income_lines'

const PERIODS_PER_YEAR: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  biannual: 2,
  annual: 1,
}

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
  /**
   * False for a non-monthly utility line viewed in a month that isn't its
   * actual billing month - that month's figure is a computed share of a
   * bill entered elsewhere, not something to edit directly.
   */
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
      const shares = expandUtilityBillsToMonthlyShares(bills, utility.frequency)
      const trend = this.rollingAverage.computeTrend(shares)
      const monthShare = shares.find((share) => share.year === year && share.month === month)
      const monthBill = monthShare ? bills.find((b) => b.id === monthShare.billId) : undefined

      lines.push({
        key: `utility-${utility.id}`,
        label: utility.name,
        projected: trend.average ?? 0,
        actual: monthShare ? round(monthShare.amount) : null,
        dueDay: null,
        dueDate: this.utilityDueDate(utility, bills, year, month),
        paid: monthBill?.paid ?? false,
        editable: isUtilityBillingMonth(utility, bills, year, month),
      })
    }

    const recurringBills = await RecurringBill.query()
      .where('isActive', true)
      .andWhere('isPaused', false)
      .andWhere('isArchived', false)
      .orderBy('name', 'asc')
    const monthlyBillIds = recurringBills
      .filter((bill) => bill.frequency === 'monthly')
      .map((bill) => bill.id)
    const recurringBillPayments = monthlyBillIds.length
      ? await RecurringBillPayment.query()
          .whereIn('recurringBillId', monthlyBillIds)
          .where('year', year)
          .where('month', month)
      : []
    const recurringBillPaidById = new Map(
      recurringBillPayments.map((payment) => [payment.recurringBillId, payment.paid])
    )

    let nonMonthlyAmortizedTotal = 0
    for (const bill of recurringBills) {
      if (bill.frequency === 'monthly') {
        lines.push({
          key: `recurring-bill-${bill.id}`,
          label: bill.name,
          projected: bill.amount,
          actual: bill.amount,
          dueDay: bill.dueDay,
          dueDate: null,
          paid: recurringBillPaidById.get(bill.id) ?? isPastMonth,
          editable: true,
        })
      } else {
        // The `?? 1` fallback can't fire: the `frequency` column has a DB-level
        // CHECK constraint restricting it to 'monthly'|'quarterly'|'biannual'|
        // 'annual'|'custom' - 'monthly' is handled above and 'custom' just
        // above, so every value reaching this lookup is already in the map.
        const periodsPerYear =
          bill.frequency === 'custom'
            ? this.customPeriodsPerYear(bill.customIntervalValue, bill.customIntervalUnit)
            : /* c8 ignore next */ (PERIODS_PER_YEAR[bill.frequency] ?? 1)
        nonMonthlyAmortizedTotal += (bill.amount * periodsPerYear) / 12
      }
    }
    if (nonMonthlyAmortizedTotal > 0) {
      lines.push({
        key: 'recurring-bills-avg',
        label: 'Recurring Bills (avg)',
        projected: round(nonMonthlyAmortizedTotal),
        actual: null,
        dueDay: null,
        dueDate: null,
        paid: false,
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
        paid: false,
        editable: true,
      })
    }

    return lines
  }

  /**
   * Utilities aren't billed on a fixed calendar day like recurring bills -
   * a bill covers a period ending in some month, and payment is due a
   * configured number of days after that. Anchors the billing cycle on the
   * utility's most recent actual bill so non-monthly utilities (e.g. a
   * quarterly water bill) only show a due date in the months they're
   * actually billed, not every month.
   */
  private utilityDueDate(
    utility: Utility,
    bills: UtilityBill[],
    year: number,
    month: number
  ): string | null {
    if (utility.dueOffsetDays === null) return null

    const periodMonths = utilityPeriodMonths(utility.frequency)
    if (periodMonths > 1) {
      const mostRecentBill = mostRecentUtilityBill(bills)

      if (mostRecentBill) {
        const anchorIndex = mostRecentBill.year * 12 + mostRecentBill.month
        const viewedIndex = year * 12 + month
        const diff = (((viewedIndex - anchorIndex) % periodMonths) + periodMonths) % periodMonths
        if (diff !== 0) return null
      }
    }

    // Full ISO datetime (not just a date) to match how every other date
    // field in the API is returned - the frontend's formatDate() expects
    // this and doesn't do timezone-safe parsing of bare date strings.
    return DateTime.utc(year, month, 1)
      .endOf('month')
      .startOf('day')
      .plus({ days: utility.dueOffsetDays })
      .toISO()
  }

  private customPeriodsPerYear(value: number | null, unit: string | null): number {
    if (!value || !unit) return 1
    if (unit === 'days') return 365 / value
    if (unit === 'weeks') return 52 / value
    if (unit === 'months') return 12 / value
    return 1
  }
}
