import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import { RollingAverageService } from '#services/rolling_average_service'
import { StandardMonthService } from '#services/standard_month_service'
import { expandUtilityBillsToMonthlyShares } from '#services/utility_billing_period'

const UPCOMING_BILLS_LIMIT = 5
const MONTHLY_EXPENSE_WINDOW = 12

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export default class DashboardController {
  async summary({ response }: HttpContext) {
    const today = DateTime.local()

    const [monthResult, utilities, upcomingBills, monthlyExpenses] = await Promise.all([
      new StandardMonthService().compute(today.year, today.month),
      this.utilityTrends(),
      this.upcomingBills(),
      this.monthlyExpenses(today),
    ])

    return response.json({
      currentMonth: {
        year: today.year,
        month: today.month,
        projectedNet: monthResult.projectedNet,
        actualNet: monthResult.actualNet,
      },
      upcomingBills,
      utilities,
      monthlyExpenses,
    })
  }

  private async utilityTrends() {
    const utilities = await Utility.query().where('isActive', true).orderBy('name', 'asc')
    const rollingAverage = new RollingAverageService()

    return Promise.all(
      utilities.map(async (utility) => {
        const bills = await UtilityBill.query().where('utilityId', utility.id)
        const trend = rollingAverage.computeTrend(
          expandUtilityBillsToMonthlyShares(bills, utility.frequency)
        )
        return {
          id: utility.id,
          name: utility.name,
          latestAmount: trend.latestAmount,
          average: trend.average,
          trend: trend.trend,
          sparkline: trend.months.map((entry) => entry.amount),
        }
      })
    )
  }

  private async upcomingBills() {
    const bills = await RecurringBill.query()
      .where('isActive', true)
      .whereNotNull('nextDueOn')
      .orderBy('nextDueOn', 'asc')
      .limit(UPCOMING_BILLS_LIMIT)

    const todayStart = DateTime.utc().startOf('day')
    return bills.map((bill) => ({
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      // whereNotNull('nextDueOn') above guarantees this is always set.
      nextDueOn: bill.nextDueOn!.toISODate(),
      daysUntilDue: Math.floor(bill.nextDueOn!.diff(todayStart, 'days').days),
    }))
  }

  /**
   * Total actual spend per month for the trailing window - utility bills and
   * category actuals are the two tables with real per-month historical
   * depth (recurring bills/subscriptions only carry a current snapshot
   * amount, not a monthly log, so they're left out to avoid implying a
   * false history).
   */
  private async monthlyExpenses(today: DateTime) {
    const start = today.startOf('month').minus({ months: MONTHLY_EXPENSE_WINDOW - 1 })

    const [utilityBills, categoryActuals] = await Promise.all([
      UtilityBill.query().preload('utility'),
      CategoryMonthlyActual.query(),
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
    for (const actual of categoryActuals) {
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
}
