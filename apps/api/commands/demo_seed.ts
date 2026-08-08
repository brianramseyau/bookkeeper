import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import hash from '@adonisjs/core/services/hash'
import env from '#start/env'
import User from '#models/user'
import Category from '#models/category'
import Expense from '#models/expense'
import ExpenseBudgetItem from '#models/expense_budget_item'
import ExpenseMonthlyActual from '#models/expense_monthly_actual'
import ExpensePayment from '#models/expense_payment'
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
import { isRecurringBillDueMonth } from '#services/recurring_bill_due_date'

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

/** The ending year of the Jul-Jun Australian financial year `date` falls in. */
function financialYearEnding(date: DateTime): number {
  return date.month >= 7 ? date.year + 1 : date.year
}

/** The ending year of the current Jul-Jun Australian financial year. */
function currentFinancialYear(): number {
  return financialYearEnding(DateTime.utc())
}

/**
 * Every month from the start of last financial year through the current
 * month, oldest first. Last FY is fully in the past so it's always seeded
 * completely; the current FY only gets months up to "now" - seeding months
 * that haven't happened yet would misrepresent the app's own conventions
 * (income received, bills paid, etc. can't exist ahead of today). Depending
 * on where in the year this runs, that's anywhere from 13 to a little under
 * 24 months.
 */
function demoMonths(): DemoMonth[] {
  const today = DateTime.utc().startOf('month')
  const lastFullFyEnd = currentFinancialYear() - 1
  const start = DateTime.utc(lastFullFyEnd - 1, 7, 1)

  const months: DemoMonth[] = []
  for (let cursor = start; cursor <= today; cursor = cursor.plus({ months: 1 })) {
    months.push({
      year: cursor.year,
      month: cursor.month,
      isCurrent: cursor.hasSame(today, 'month'),
    })
  }
  return months
}

/** The distinct financial years (ending year) spanned by `months`, ascending. */
function financialYearsSpanned(months: DemoMonth[]): number[] {
  const years = new Set(
    months.map(({ year, month }) => financialYearEnding(DateTime.utc(year, month, 1)))
  )
  return [...years].sort((a, b) => a - b)
}

/**
 * A due date `monthsFromNow` out, on `day` (clamped to that month's length).
 * Doesn't need to be re-derived on every run - `resolveNextOccurrence`
 * (`#services/recurring_bill_due_date`) rolls a stale anchor forward by the
 * bill's own frequency at read time, so this only has to land on a
 * plausible date once. The resulting `dueMonth` also anchors which months
 * are historically "due" for cyclical bills (`isRecurringBillDueMonth`
 * doesn't care about year), so it's reused below to backfill payment
 * history across the whole seeded window.
 */
function upcomingDueDate(monthsFromNow: number, day: number): DateTime {
  const target = DateTime.utc().startOf('day').plus({ months: monthsFromNow })
  return DateTime.utc(target.year, target.month, Math.min(day, target.daysInMonth ?? 28))
}

function round2(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * A 0..1 seasonal multiplier peaking in Australian winter (July) and
 * troughing in summer (January), used to give heating-driven utilities
 * (electricity, gas) a believable shape across a full year of history.
 */
function winterFactor(month: number): number {
  return (1 + Math.cos(((month - 7) / 12) * 2 * Math.PI)) / 2
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
      // Not Category - migrations always create the protected "Utilities"
      // system category, so it's never empty even on a freshly-migrated DB
      // and would make this check refuse to run unconditionally.
      Expense.query().first(),
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
    const fiscalYears = financialYearsSpanned(months)
    const lastFullFy = fiscalYears[0]!
    const currentFy = fiscalYears[fiscalYears.length - 1]!

    await db.transaction(async (trx) => {
      const [jordanRow, taylorRow] = DEMO_USERS
      const jordan = await insertDemoUser(trx, jordanRow!)
      const taylor = await insertDemoUser(trx, taylorRow!)

      // Lean Category tags - "Utilities" already exists by the time this
      // runs (migrations always create the protected system category), so
      // it's looked up rather than created.
      const utilitiesCategory = await Category.query({ client: trx })
        .where('name', 'Utilities')
        .firstOrFail()
      const subscriptionsCategory = await Category.create(
        { name: 'Subscriptions', color: '#a855f7' },
        { client: trx }
      )
      const insuranceCategory = await Category.create(
        { name: 'Insurance', color: '#8b5cf6' },
        { client: trx }
      )
      const childcareCategory = await Category.create(
        { name: 'Childcare', color: '#14b8a6' },
        { client: trx }
      )
      const groceriesCategory = await Category.create(
        { name: 'Groceries', color: '#22c55e' },
        { client: trx }
      )
      const householdCategory = await Category.create(
        { name: 'Household', color: '#f59e0b' },
        { client: trx }
      )
      const transportCategory = await Category.create(
        { name: 'Transport', color: '#0ea5e9' },
        { client: trx }
      )
      const clothingCategory = await Category.create(
        { name: 'Clothing', color: '#f43f5e' },
        { client: trx }
      )
      const petsCategory = await Category.create(
        { name: 'Pets', color: '#84cc16' },
        { client: trx }
      )
      const feesCategory = await Category.create(
        { name: 'Fees & Charges', color: '#64748b' },
        { client: trx }
      )

      // Expenses - the actual budget/trend/actuals-tracking entities, each
      // bound to the category it most naturally belongs to.
      const groceries = await Expense.create(
        { name: 'Groceries', categoryId: groceriesCategory.id },
        { client: trx }
      )
      const household = await Expense.create(
        { name: 'Household', categoryId: householdCategory.id },
        { client: trx }
      )
      const fees = await Expense.create(
        { name: 'Fees', budgetAmount: 25, categoryId: feesCategory.id },
        { client: trx }
      )
      const transport = await Expense.create(
        { name: 'Transport', categoryId: transportCategory.id },
        { client: trx }
      )
      const clothing = await Expense.create(
        { name: 'Clothing', categoryId: clothingCategory.id },
        { client: trx }
      )
      const dog = await Expense.create(
        { name: 'Dog', categoryId: petsCategory.id },
        { client: trx }
      )

      // Two expenses driven by a budget breakdown rather than logged
      // actuals - shows off expense budget items with nothing further to log.
      const householdItems = [
        { name: 'Cleaning Supplies', amount: 35 },
        { name: 'Home Maintenance Fund', amount: 150 },
      ]
      for (const item of householdItems) {
        await ExpenseBudgetItem.create(
          { expenseId: household.id, name: item.name, amount: item.amount },
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
        await ExpenseBudgetItem.create(
          { expenseId: dog.id, name: item.name, amount: item.amount },
          { client: trx }
        )
      }
      dog.budgetAmount = dogItems.reduce((sum, item) => sum + item.amount, 0)
      await dog.useTransaction(trx).save()

      // Utilities - Electricity/Gas billed monthly with a winter-trending
      // shape across the full seeded year (Australian winter peaks in
      // July), Internet billed monthly with a flat price rise at the start
      // of the current financial year, Water billed quarterly.
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

      for (const [index, { year, month, isCurrent }] of months.entries()) {
        const electricityAmount = round2(150 + 140 * winterFactor(month) + index * 0.6)
        const gasAmount = round2(15 + 110 * winterFactor(month) + index * 0.4)
        const internetAmount =
          financialYearEnding(DateTime.utc(year, month, 1)) === currentFy ? 84.99 : 79.99

        await UtilityBill.create(
          { utilityId: electricity.id, year, month, amount: electricityAmount, paid: !isCurrent },
          { client: trx }
        )
        await UtilityBill.create(
          { utilityId: gas.id, year, month, amount: gasAmount, paid: !isCurrent },
          { client: trx }
        )
        await UtilityBill.create(
          { utilityId: internet.id, year, month, amount: internetAmount, paid: !isCurrent },
          { client: trx }
        )
      }

      // Quarterly, from the first seeded month - the months between are
      // correctly billing-free, same as the real app.
      for (let index = 0; index < months.length; index += 3) {
        const { year, month, isCurrent } = months[index]!
        const waterAmount = round2(280 + 30 * winterFactor(month) + index * 0.5)
        await UtilityBill.create(
          { utilityId: water.id, year, month, amount: waterAmount, paid: !isCurrent },
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
      const healthInsurance = await RecurringBill.create(
        {
          name: 'Health Insurance',
          categoryId: insuranceCategory.id,
          amount: 210.5,
          frequency: 'monthly',
          dueDay: 10,
        },
        { client: trx }
      )
      const childcare = await RecurringBill.create(
        {
          name: 'Childcare',
          categoryId: childcareCategory.id,
          amount: 850,
          frequency: 'monthly',
          dueDay: 1,
        },
        { client: trx }
      )
      const pestControlDue = upcomingDueDate(2, 8)
      const pestControl = await RecurringBill.create(
        {
          name: 'Pest Control',
          categoryId: householdCategory.id,
          amount: 150,
          frequency: 'quarterly',
          dueDay: pestControlDue.day,
          dueMonth: pestControlDue.month,
        },
        { client: trx }
      )
      const contentsInsuranceDue = upcomingDueDate(4, 12)
      const contentsInsurance = await RecurringBill.create(
        {
          name: 'Home & Contents Insurance',
          categoryId: insuranceCategory.id,
          amount: 620,
          frequency: 'annual',
          dueDay: contentsInsuranceDue.day,
          dueMonth: contentsInsuranceDue.month,
        },
        { client: trx }
      )
      const carRegoDue = upcomingDueDate(9, 20)
      const carRego = await RecurringBill.create(
        {
          name: 'Car Registration',
          categoryId: transportCategory.id,
          amount: 780,
          frequency: 'annual',
          dueDay: carRegoDue.day,
          dueMonth: carRegoDue.month,
        },
        { client: trx }
      )

      // Payment history for every recurring bill across the whole seeded
      // window - monthly bills are due every month; quarterly/annual bills
      // only on the months their cycle actually lands on
      // (`isRecurringBillDueMonth`, same rule the app itself uses). The
      // current month is left outstanding for each, past occurrences paid.
      const monthlyRecurringBills = [streaming, healthInsurance, childcare]
      const cyclicalRecurringBills = [
        { bill: pestControl, frequency: 'quarterly', dueMonth: pestControlDue.month },
        { bill: contentsInsurance, frequency: 'annual', dueMonth: contentsInsuranceDue.month },
        { bill: carRego, frequency: 'annual', dueMonth: carRegoDue.month },
      ]
      for (const { year, month, isCurrent } of months) {
        for (const bill of monthlyRecurringBills) {
          await RecurringBillPayment.create(
            { recurringBillId: bill.id, year, month, paid: !isCurrent },
            { client: trx }
          )
        }
        for (const { bill, frequency, dueMonth } of cyclicalRecurringBills) {
          if (isRecurringBillDueMonth(frequency, dueMonth, null, year, month)) {
            await RecurringBillPayment.create(
              { recurringBillId: bill.id, year, month, paid: !isCurrent },
              { client: trx }
            )
          }
        }
      }

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
      const gym = await UserSubscription.create(
        {
          userId: jordan.id,
          categoryId: subscriptionsCategory.id,
          name: 'Gym Membership',
          amount: 59.9,
          dayOfMonth: 15,
        },
        { client: trx }
      )
      const netflix = await UserSubscription.create(
        {
          userId: taylor.id,
          categoryId: subscriptionsCategory.id,
          name: 'Netflix',
          amount: 16.99,
          dayOfMonth: 8,
        },
        { client: trx }
      )
      const yogaApp = await UserSubscription.create(
        {
          userId: taylor.id,
          categoryId: subscriptionsCategory.id,
          name: 'Yoga App',
          amount: 14.99,
          dayOfMonth: 20,
        },
        { client: trx }
      )

      const subscriptions = [spotify, gym, netflix, yogaApp]
      for (const { year, month, isCurrent } of months) {
        for (const subscription of subscriptions) {
          await SubscriptionPayment.create(
            { userSubscriptionId: subscription.id, year, month, paid: !isCurrent },
            { client: trx }
          )
        }
      }

      // Expense actuals - Groceries/Transport logged every month, Clothing
      // logged sparsely (a realistic "not every month" spend pattern).
      // Reconciliation (ExpensePayment) is backfilled for every expense
      // across the whole window regardless of whether it has actuals -
      // budget-item-driven expenses (Household, Dog) and the flat-amount
      // one (Fees) can be reconciled without ever logging an actual.
      const expenses = [groceries, household, fees, transport, clothing, dog]
      for (const [index, { year, month, isCurrent }] of months.entries()) {
        const groceriesAmount = round2(640 + winterFactor(month) * 25 + index * 2.4)
        const transportAmount = round2(165 + (index % 5) * 12 - winterFactor(month) * 10)

        await ExpenseMonthlyActual.create(
          {
            expenseId: groceries.id,
            occurredOn: DateTime.utc(year, month, 18),
            amount: groceriesAmount,
          },
          { client: trx }
        )
        await ExpenseMonthlyActual.create(
          {
            expenseId: transport.id,
            occurredOn: DateTime.utc(year, month, 18),
            amount: transportAmount,
          },
          { client: trx }
        )
        if (index % 3 === 1) {
          const clothingAmount = round2(60 + (index % 4) * 22)
          await ExpenseMonthlyActual.create(
            {
              expenseId: clothing.id,
              occurredOn: DateTime.utc(year, month, 18),
              amount: clothingAmount,
            },
            { client: trx }
          )
        }

        for (const expense of expenses) {
          await ExpensePayment.create(
            { expenseId: expense.id, year, month, paid: !isCurrent },
            { client: trx }
          )
        }
      }

      // Income - Jordan paid monthly, Taylor paid fortnightly (so some
      // months land 3 pay periods, same as real life). Both get a raise
      // effective at the start of the current financial year.
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
          anchorDate: DateTime.utc(lastFullFy - 1, 7, 7),
          taxWithheld: true,
        },
        { client: trx }
      )

      for (const { year, month } of months) {
        const isCurrentFy = financialYearEnding(DateTime.utc(year, month, 1)) === currentFy
        const jordanAmount = isCurrentFy ? 6350 : 6200
        const taylorAmount = isCurrentFy ? 2520 : 2450

        const jordanDates = payDatesInMonth(jordanSource, year, month)
        for (const receivedOn of jordanDates) {
          await IncomeEntry.create(
            {
              incomeSourceId: jordanSource.id,
              userId: jordan.id,
              year,
              month,
              receivedOn,
              amount: jordanAmount,
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
              amount: taylorAmount,
            },
            { client: trx }
          )
        }
      }

      // One-off non-PAYG entries (unattributed - no income_source_id), one
      // per seeded financial year, exercising the Income page's non-PAYG
      // section across more than one tax year.
      const freelanceMonths = [months[1]!, months[months.length - 2] ?? months[months.length - 1]!]
      for (const freelanceMonth of freelanceMonths) {
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
      }

      // A marginal-rate tax setting for every seeded financial year, for
      // both users.
      for (const financialYear of fiscalYears) {
        const marginalRate = financialYear === currentFy ? 0.325 : 0.3
        await IncomeTaxSetting.create(
          { userId: jordan.id, financialYear, marginalRate },
          { client: trx }
        )
        await IncomeTaxSetting.create(
          { userId: taylor.id, financialYear, marginalRate: marginalRate - 0.02 },
          { client: trx }
        )
      }

      // Carryover across every seeded month, so the standard-month
      // projection has real history to compare against, not just the
      // current month.
      for (const [index, { year, month }] of months.entries()) {
        await MonthCarryover.create(
          { year, month, amount: round2(950 + (index % 6) * 45) },
          { client: trx }
        )
      }
    })

    this.logger.success(
      `Seeded ${months.length} months of demo data (FY${lastFullFy} - FY${currentFy}) - log in as ` +
        `${DEMO_USERS.map((u) => u.email).join(' or ')} with password "${DEMO_PASSWORD}"`
    )
  }
}
