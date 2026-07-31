import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import hash from '@adonisjs/core/services/hash'
import env from '#start/env'
import User from '#models/user'
import Category from '#models/category'
import CategoryBudgetItem from '#models/category_budget_item'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import CategoryPayment from '#models/category_payment'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'
import UserSubscription from '#models/user_subscription'
import SubscriptionPayment from '#models/subscription_payment'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import IncomeTaxSetting from '#models/income_tax_setting'
import MonthCarryover from '#models/month_carryover'
import { payDatesInMonth } from '#services/income_cadence'

/** Fictional login the demo instance is seeded with - not read from anywhere real. */
const DEMO_USERS = [
  { fullName: 'Jordan Demo', email: 'jordan@demo.local', displayColor: '#6366f1' },
  { fullName: 'Taylor Demo', email: 'taylor@demo.local', displayColor: '#ec4899' },
]
const DEMO_PASSWORD = 'DemoPass123!'

interface DemoMonth {
  year: number
  month: number
  isCurrent: boolean
}

/** How many months of trailing history (plus the current month) to seed for bills/actuals/income. */
const MONTHS_OF_HISTORY = 5

/** The current month and the `MONTHS_OF_HISTORY` before it, oldest first. */
function demoMonths(): DemoMonth[] {
  const today = DateTime.utc()
  const months: DemoMonth[] = []
  for (let i = MONTHS_OF_HISTORY; i >= 0; i--) {
    const d = today.minus({ months: i })
    months.push({ year: d.year, month: d.month, isCurrent: i === 0 })
  }
  return months
}

/**
 * A due date `monthsFromNow` out, on `day` (clamped to that month's length).
 * Doesn't need to be re-derived on every run - `resolveNextOccurrence`
 * (`#services/recurring_bill_due_date`) rolls a stale anchor forward by the
 * bill's own frequency at read time, so this only has to land on a
 * plausible date once.
 */
function upcomingDueDate(monthsFromNow: number, day: number): DateTime {
  const target = DateTime.utc().startOf('day').plus({ months: monthsFromNow })
  return DateTime.utc(target.year, target.month, Math.min(day, target.daysInMonth ?? 28))
}

/** The ending year of the current Jul-Jun Australian financial year. */
function currentFinancialYear(): number {
  const today = DateTime.utc()
  return today.month >= 7 ? today.year + 1 : today.year
}

/**
 * Inserts a user with a pre-hashed password via a raw insert rather than
 * `User.create()`. `#models/user` composes `withAuthFinder(hash)` at
 * class-definition time, which snapshots the `hash` service's value into a
 * closure right then rather than reading it live - if that snapshot happens
 * before the app has finished resolving the service (which it reliably does
 * for an ace command, since routes/controllers get preloaded on a different
 * timeline than plain top-level command imports), every `User.create()`/
 * `.save()` in that process permanently throws trying to hash a password,
 * even though the `hash` service itself is fine everywhere else. Hashing
 * directly and inserting the row ourselves sidesteps that hook entirely.
 */
async function insertDemoUser(
  trx: TransactionClientContract,
  row: { fullName: string; email: string; displayColor: string }
): Promise<User> {
  const now = DateTime.utc()
  await trx
    .insertQuery()
    .table('users')
    .insert({
      full_name: row.fullName,
      email: row.email,
      password: await hash.use().make(DEMO_PASSWORD),
      display_color: row.displayColor,
      created_at: now.toSQL(),
      updated_at: now.toSQL(),
    })
  return User.query({ client: trx }).where('email', row.email).firstOrFail()
}

export default class DemoSeed extends BaseCommand {
  static commandName = 'demo:seed'
  static description =
    'Seed fictional demo data for an ephemeral, dev-only showcase instance (refuses to run in production or against a database that already has data)'

  static options: CommandOptions = {
    startApp: true,
  }

  /** True (and logs why) if it's not safe to write demo data right now. */
  private async isUnsafe(): Promise<boolean> {
    if (env.get('NODE_ENV') === 'production') {
      this.logger.error(
        'Refusing to run with NODE_ENV=production - demo:seed writes fictional data for a ' +
          'throwaway showcase instance, never a real deployment.'
      )
      return true
    }

    const existingRows = await Promise.all([
      User.query().first(),
      Category.query().first(),
      Utility.query().first(),
      RecurringBill.query().first(),
      UserSubscription.query().first(),
      IncomeSource.query().first(),
    ])
    if (existingRows.some((row) => row !== null)) {
      this.logger.error(
        'Refusing to run against a database that already has data - point DB_FILENAME at a ' +
          'fresh file, run "node ace migration:run", then try again.'
      )
      return true
    }

    return false
  }

  async run() {
    if (await this.isUnsafe()) {
      this.exitCode = 1
      return
    }

    const months = demoMonths()
    const current = months[months.length - 1]!

    await db.transaction(async (trx) => {
      const [jordanRow, taylorRow] = DEMO_USERS
      const jordan = await insertDemoUser(trx, jordanRow!)
      const taylor = await insertDemoUser(trx, taylorRow!)

      const groceries = await Category.create(
        { name: 'Groceries', color: '#22c55e' },
        { client: trx }
      )
      const household = await Category.create(
        { name: 'Household', color: '#f59e0b' },
        { client: trx }
      )
      const utilitiesCategory = await Category.create(
        { name: 'Utilities', color: '#0ea5e9' },
        { client: trx }
      )
      const subscriptionsCategory = await Category.create(
        { name: 'Subscriptions', color: '#a855f7' },
        { client: trx }
      )
      await Category.create({ name: 'Fees', color: '#64748b', budgetAmount: 25 }, { client: trx })
      const transport = await Category.create(
        { name: 'Transport', color: '#3b82f6' },
        { client: trx }
      )
      const clothing = await Category.create(
        { name: 'Clothing', color: '#f43f5e' },
        { client: trx }
      )
      const childcare = await Category.create(
        { name: 'Childcare', color: '#14b8a6' },
        { client: trx }
      )
      const insurance = await Category.create(
        { name: 'Insurance', color: '#8b5cf6' },
        { client: trx }
      )
      const dog = await Category.create({ name: 'Dog', color: '#d97706' }, { client: trx })

      // Two categories driven by a budget breakdown rather than logged
      // actuals - shows off category budget items with nothing further to log.
      const householdItems = [
        { name: 'Cleaning Supplies', amount: 35 },
        { name: 'Home Maintenance Fund', amount: 150 },
      ]
      for (const item of householdItems) {
        await CategoryBudgetItem.create(
          { categoryId: household.id, name: item.name, amount: item.amount },
          { client: trx }
        )
      }
      household.budgetAmount = householdItems.reduce((sum, item) => sum + item.amount, 0)
      await household.useTransaction(trx).save()

      const dogItems = [
        { name: 'Food & Treats', amount: 65 },
        { name: 'Vet Insurance', amount: 48 },
      ]
      for (const item of dogItems) {
        await CategoryBudgetItem.create(
          { categoryId: dog.id, name: item.name, amount: item.amount },
          { client: trx }
        )
      }
      dog.budgetAmount = dogItems.reduce((sum, item) => sum + item.amount, 0)
      await dog.useTransaction(trx).save()

      // Utilities - Electricity/Gas/Internet billed monthly, Water quarterly,
      // with a winter-trending-up shape over the seeded window (today's month
      // is Australian winter) so the rolling-average trend arrow has
      // something real to show.
      const electricity = await Utility.create(
        {
          name: 'Electricity',
          categoryId: utilitiesCategory.id,
          frequency: 'monthly',
          dueOffsetDays: 13,
        },
        { client: trx }
      )
      const gas = await Utility.create(
        { name: 'Gas', categoryId: utilitiesCategory.id, frequency: 'monthly', dueOffsetDays: 16 },
        { client: trx }
      )
      const internet = await Utility.create(
        {
          name: 'Internet',
          categoryId: utilitiesCategory.id,
          frequency: 'monthly',
          dueOffsetDays: 14,
        },
        { client: trx }
      )
      const water = await Utility.create(
        {
          name: 'Water',
          categoryId: utilitiesCategory.id,
          frequency: 'quarterly',
          dueOffsetDays: 28,
        },
        { client: trx }
      )

      const electricityAmounts = [188.4, 205.75, 224.1, 249.85, 271.3, 298.6]
      const gasAmounts = [22.15, 35.8, 58.4, 79.95, 102.2, 124.75]
      const internetAmounts = [79.99, 79.99, 79.99, 84.99, 84.99, 84.99]

      for (const [index, { year, month, isCurrent }] of months.entries()) {
        await UtilityBill.create(
          {
            utilityId: electricity.id,
            year,
            month,
            amount: electricityAmounts[index]!,
            paid: !isCurrent,
          },
          { client: trx }
        )
        await UtilityBill.create(
          { utilityId: gas.id, year, month, amount: gasAmounts[index]!, paid: !isCurrent },
          { client: trx }
        )
        await UtilityBill.create(
          {
            utilityId: internet.id,
            year,
            month,
            amount: internetAmounts[index]!,
            paid: !isCurrent,
          },
          { client: trx }
        )
      }

      // Two quarterly bills across the window (index 0 and 3) - the months
      // between/after them are correctly billing-free, same as the real app.
      const waterBillIndexes: [number, number][] = [
        [0, 312.6],
        [3, 296.4],
      ]
      for (const [index, amount] of waterBillIndexes) {
        const { year, month } = months[index]!
        await UtilityBill.create(
          { utilityId: water.id, year, month, amount, paid: true },
          { client: trx }
        )
      }

      // Recurring bills - a mix of monthly, quarterly and annual cadences.
      const streaming = await RecurringBill.create(
        {
          name: 'Streaming Service',
          categoryId: subscriptionsCategory.id,
          amount: 19.99,
          frequency: 'monthly',
          dueDay: 5,
        },
        { client: trx }
      )
      await RecurringBill.create(
        {
          name: 'Health Insurance',
          categoryId: insurance.id,
          amount: 210.5,
          frequency: 'monthly',
          dueDay: 10,
        },
        { client: trx }
      )
      await RecurringBill.create(
        {
          name: 'Childcare',
          categoryId: childcare.id,
          amount: 850,
          frequency: 'monthly',
          dueDay: 1,
        },
        { client: trx }
      )
      const pestControlDue = upcomingDueDate(2, 8)
      await RecurringBill.create(
        {
          name: 'Pest Control',
          categoryId: household.id,
          amount: 150,
          frequency: 'quarterly',
          dueDay: pestControlDue.day,
          dueMonth: pestControlDue.month,
        },
        { client: trx }
      )
      const contentsInsuranceDue = upcomingDueDate(4, 12)
      await RecurringBill.create(
        {
          name: 'Home & Contents Insurance',
          categoryId: insurance.id,
          amount: 620,
          frequency: 'annual',
          dueDay: contentsInsuranceDue.day,
          dueMonth: contentsInsuranceDue.month,
        },
        { client: trx }
      )
      const carRegoDue = upcomingDueDate(9, 20)
      await RecurringBill.create(
        {
          name: 'Car Registration',
          categoryId: transport.id,
          amount: 780,
          frequency: 'annual',
          dueDay: carRegoDue.day,
          dueMonth: carRegoDue.month,
        },
        { client: trx }
      )

      // Already paid this month, to show both checkbox states on the
      // Monthly page rather than everything defaulting to "outstanding".
      await RecurringBillPayment.create(
        { recurringBillId: streaming.id, year: current.year, month: current.month, paid: true },
        { client: trx }
      )

      // Personal subscriptions, one pair per user.
      const spotify = await UserSubscription.create(
        {
          userId: jordan.id,
          categoryId: subscriptionsCategory.id,
          name: 'Spotify',
          amount: 11.99,
          dayOfMonth: 3,
        },
        { client: trx }
      )
      await UserSubscription.create(
        {
          userId: jordan.id,
          categoryId: subscriptionsCategory.id,
          name: 'Gym Membership',
          amount: 59.9,
          dayOfMonth: 15,
        },
        { client: trx }
      )
      await UserSubscription.create(
        {
          userId: taylor.id,
          categoryId: subscriptionsCategory.id,
          name: 'Netflix',
          amount: 16.99,
          dayOfMonth: 8,
        },
        { client: trx }
      )
      await UserSubscription.create(
        {
          userId: taylor.id,
          categoryId: subscriptionsCategory.id,
          name: 'Yoga App',
          amount: 14.99,
          dayOfMonth: 20,
        },
        { client: trx }
      )

      await SubscriptionPayment.create(
        { userSubscriptionId: spotify.id, year: current.year, month: current.month, paid: true },
        { client: trx }
      )

      // Category actuals - Groceries/Transport logged every month, Clothing
      // logged sparsely (a realistic "not every month" spend pattern).
      const groceriesAmounts = [652.3, 698.15, 671.9, 715.4, 683.25, 705.6]
      const transportAmounts = [165, 210.5, 188.75, 225, 172.4, 198.9]
      const clothingByIndex = new Map<number, number>([
        [1, 145],
        [3, 68.5],
        [5, 92],
      ])

      for (const [index, { year, month }] of months.entries()) {
        await CategoryMonthlyActual.create(
          {
            categoryId: groceries.id,
            occurredOn: DateTime.utc(year, month, 18),
            amount: groceriesAmounts[index]!,
          },
          { client: trx }
        )
        await CategoryMonthlyActual.create(
          {
            categoryId: transport.id,
            occurredOn: DateTime.utc(year, month, 18),
            amount: transportAmounts[index]!,
          },
          { client: trx }
        )
        const clothingAmount = clothingByIndex.get(index)
        if (clothingAmount !== undefined) {
          await CategoryMonthlyActual.create(
            {
              categoryId: clothing.id,
              occurredOn: DateTime.utc(year, month, 18),
              amount: clothingAmount,
            },
            { client: trx }
          )
        }
      }

      // Reconciled this month (Transport) vs. still outstanding (Groceries) -
      // again, showing both states rather than one uniform default.
      await CategoryPayment.create(
        { categoryId: transport.id, year: current.year, month: current.month, paid: true },
        { client: trx }
      )

      // Income - Jordan paid monthly with a mid-window raise, Taylor paid
      // fortnightly (so some months land 3 pay periods, same as real life).
      const jordanSource = await IncomeSource.create(
        {
          userId: jordan.id,
          name: 'Salary',
          expectedAmount: 6350,
          frequency: 'monthly',
          payDayOfMonth: 15,
          weekendRollback: true,
          taxWithheld: true,
        },
        { client: trx }
      )
      const taylorSource = await IncomeSource.create(
        {
          userId: taylor.id,
          name: 'Salary',
          expectedAmount: 2520,
          frequency: 'fortnightly',
          anchorDate: DateTime.utc(2026, 1, 7),
          taxWithheld: true,
        },
        { client: trx }
      )

      const jordanMonthlyAmounts = [6200, 6200, 6200, 6350, 6350, 6350]
      const taylorPerPayAmounts = [2450, 2450, 2450, 2520, 2520, 2520]

      for (const [index, { year, month }] of months.entries()) {
        const jordanDates = payDatesInMonth(jordanSource, year, month)
        for (const receivedOn of jordanDates) {
          await IncomeEntry.create(
            {
              incomeSourceId: jordanSource.id,
              userId: jordan.id,
              year,
              month,
              receivedOn,
              amount: jordanMonthlyAmounts[index]!,
            },
            { client: trx }
          )
        }

        const taylorDates = payDatesInMonth(taylorSource, year, month)
        for (const receivedOn of taylorDates) {
          await IncomeEntry.create(
            {
              incomeSourceId: taylorSource.id,
              userId: taylor.id,
              year,
              month,
              receivedOn,
              amount: taylorPerPayAmounts[index]!,
            },
            { client: trx }
          )
        }
      }

      // A one-off non-PAYG entry (unattributed - no income_source_id) plus
      // the marginal-rate setting it's taxed against, exercising the
      // Income page's non-PAYG section too.
      const freelanceMonth = months[2]!
      await IncomeEntry.create(
        {
          userId: jordan.id,
          incomeSourceId: null,
          year: freelanceMonth.year,
          month: freelanceMonth.month,
          receivedOn: DateTime.utc(freelanceMonth.year, freelanceMonth.month, 10),
          amount: 850,
          note: 'Freelance web design invoice',
          taxWithheld: false,
        },
        { client: trx }
      )
      await IncomeTaxSetting.create(
        { userId: jordan.id, financialYear: currentFinancialYear(), marginalRate: 0.325 },
        { client: trx }
      )

      await MonthCarryover.create(
        { year: current.year, month: current.month, amount: 1180.35 },
        { client: trx }
      )
    })

    this.logger.success(
      `Seeded demo data - log in as ${DEMO_USERS.map((u) => u.email).join(' or ')} with password "${DEMO_PASSWORD}"`
    )
  }
}
