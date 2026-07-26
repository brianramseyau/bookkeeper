import { DateTime } from 'luxon'
import User from '#models/user'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import MonthCarryover from '#models/month_carryover'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import UserSubscription from '#models/user_subscription'
import Category from '#models/category'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import { RollingAverageService } from '#services/rolling_average_service'

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
}

export interface StandardMonthIncomeLine {
  key: string
  label: string
  projected: number
  actual: number
}

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
      this.computeIncome(year, month),
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

  private async computeIncome(year: number, month: number) {
    const [sources, entries] = await Promise.all([
      IncomeSource.query().where('isActive', true).orderBy('name', 'asc'),
      IncomeEntry.query().where('year', year).where('month', month),
    ])

    const actualBySource = new Map<number, number>()
    let unattributedActual = 0
    for (const entry of entries) {
      if (entry.incomeSourceId) {
        actualBySource.set(
          entry.incomeSourceId,
          (actualBySource.get(entry.incomeSourceId) ?? 0) + entry.amount
        )
      } else {
        unattributedActual += entry.amount
      }
    }

    const lines: StandardMonthIncomeLine[] = sources.map((source) => ({
      key: `income-source-${source.id}`,
      label: source.name,
      projected: source.expectedAmount,
      actual: round(actualBySource.get(source.id) ?? 0),
    }))

    if (unattributedActual > 0) {
      lines.push({
        key: 'income-unattributed',
        label: 'Other income',
        projected: 0,
        actual: round(unattributedActual),
      })
    }

    return {
      lines,
      projectedTotal: round(lines.reduce((sum, line) => sum + line.projected, 0)),
      actualTotal: round(lines.reduce((sum, line) => sum + line.actual, 0)),
    }
  }

  private async computeExpenseLines(year: number, month: number): Promise<StandardMonthLine[]> {
    const lines: StandardMonthLine[] = []

    const utilities = await Utility.query().where('isActive', true).orderBy('name', 'asc')
    for (const utility of utilities) {
      const bills = await UtilityBill.query().where('utilityId', utility.id)
      const trend = this.rollingAverage.computeTrend(
        bills.map((bill) => ({ year: bill.year, month: bill.month, amount: bill.amount }))
      )
      const actualBill = bills.find((bill) => bill.year === year && bill.month === month)

      lines.push({
        key: `utility-${utility.id}`,
        label: utility.name,
        projected: trend.average ?? 0,
        actual: actualBill ? actualBill.amount : null,
        dueDay: null,
        dueDate: this.utilityDueDate(utility, bills, year, month),
      })
    }

    const recurringBills = await RecurringBill.query()
      .where('isActive', true)
      .orderBy('name', 'asc')
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
        })
      } else {
        const periodsPerYear =
          bill.frequency === 'custom'
            ? this.customPeriodsPerYear(bill.customIntervalValue, bill.customIntervalUnit)
            : (PERIODS_PER_YEAR[bill.frequency] ?? 1)
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
      })
    }

    const users = await User.query().orderBy('fullName', 'asc')
    for (const user of users) {
      const subscriptions = await UserSubscription.query()
        .where('userId', user.id)
        .where('isActive', true)
        .where('includeInStandardMonth', true)
      if (subscriptions.length === 0) continue

      const total = round(subscriptions.reduce((sum, sub) => sum + sub.amount, 0))
      lines.push({
        key: `subscriptions-${user.id}`,
        label: `${user.fullName ?? user.email}'s Subscriptions`,
        projected: total,
        actual: total,
        dueDay: null,
        dueDate: null,
      })
    }

    const categories = await Category.query()
      .where('isActive', true)
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
        projected: category.budgetAmount ?? trend.average ?? 0,
        actual:
          thisMonthActuals.length > 0
            ? round(thisMonthActuals.reduce((sum, actual) => sum + actual.amount, 0))
            : null,
        dueDay: null,
        dueDate: null,
      })
    }

    return lines
  }

  private static readonly UTILITY_PERIOD_MONTHS: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    biannual: 6,
    annual: 12,
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

    const periodMonths = StandardMonthService.UTILITY_PERIOD_MONTHS[utility.frequency] ?? 1
    if (periodMonths > 1) {
      const mostRecentBill = bills.reduce<UtilityBill | null>((latest, bill) => {
        const billIndex = bill.year * 12 + bill.month
        const latestIndex = latest ? latest.year * 12 + latest.month : Number.NEGATIVE_INFINITY
        return billIndex > latestIndex ? bill : latest
      }, null)

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
