import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'
import User from '#models/user'
import UserSubscription from '#models/user_subscription'
import SubscriptionPayment from '#models/subscription_payment'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import CategoryPayment from '#models/category_payment'
import CategoryBudgetItem from '#models/category_budget_item'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import IncomeTaxSetting from '#models/income_tax_setting'
import MonthCarryover from '#models/month_carryover'
import { parseMatrixSheet } from '#services/import/parse_matrix_sheet'
import { parseRecurringBillsSheet } from '#services/import/parse_recurring_bills_sheet'
import { parseUserItemSheet } from '#services/import/parse_user_item_sheet'
import {
  parseSimpleActualsSheet,
  type SimpleActualRow,
} from '#services/import/parse_simple_actuals_sheet'
import { parseFoodSheet } from '#services/import/parse_food_sheet'
import { parseRollingSheet, type RollingIncomeBlock } from '#services/import/parse_rolling_sheet'
import { payDatesInMonth, payPeriodsInMonth } from '#services/income_cadence'
import {
  parseNonPaygIncomeSheet,
  type NonPaygIncomeRow,
} from '#services/import/parse_non_payg_income_sheet'

/** Sheet name -> utility name. */
const UTILITY_SHEETS = ['Electricity', 'Gas', 'Water']

/**
 * Day of the billing month each utility's bill is due - confirmed with the
 * user, since the workbook has no column for this. Covers both the
 * UTILITY_SHEETS utilities and the ones sourced from Rolling's notes
 * (see ROLLING_UTILITY_NOTES) - Phones isn't listed here since it's
 * created earlier (as an Annual-sheet bill) with its own due day already
 * set, before Rolling ever reaches it.
 */
const UTILITY_DUE_OFFSET_DAYS: Record<string, number> = {
  Electricity: 13,
  Gas: 16,
  Water: 28,
  Internet: 14,
}

/** Sheet name -> user full_name. Each sheet lists that person's personal subscriptions. */
const SUBSCRIPTION_SHEETS = ['Brian', 'Ariel']

/**
 * Real-world pay cadence for the two income sources - the workbook has no
 * column for this, so it's confirmed with the household directly rather
 * than inferred. Brian is paid monthly on the 14th (rolled back to the
 * preceding Friday on a weekend); Ariel is paid fortnightly, anchored on a
 * confirmed real payday (any date on the correct 14-day cycle works, so
 * re-asserting this on every import is harmless). Keyed by the user's
 * `fullName`, not the income source's name - both sources are just named
 * "Salary" (see MAIN_SALARY_NAME below), owner already being implicit
 * via `userId`.
 */
interface IncomeCadence {
  frequency: string
  payDayOfMonth?: number
  weekendRollback?: boolean
  anchorDate?: string
}
const INCOME_CADENCE: Record<string, IncomeCadence> = {
  Brian: { frequency: 'monthly', payDayOfMonth: 14, weekendRollback: true },
  Ariel: { frequency: 'fortnightly', anchorDate: '2026-07-22' },
}

/**
 * Name the importer seeds each user's main income source under - just
 * "Salary" rather than "${fullName} Income", since the owner is already
 * shown separately (by `userId`) and "Income" reads ambiguous now that a
 * user can have several income sources.
 */
const MAIN_SALARY_NAME = 'Salary'

/** Simple Date/Amount/Notes sheets -> the category their actuals belong to. */
const CATEGORY_ACTUAL_SHEETS: { sheet: string; category: string }[] = [
  { sheet: 'Transport', category: 'Transport' },
  { sheet: 'Clothing', category: 'Clothing' },
]

/**
 * Bills known (from inspecting the real workbook) to need a manual
 * frequency correction the importer can't infer from a single row.
 */
const FREQUENCY_CORRECTIONS: Record<string, string> = {
  'Strata Fees': "shows twice yearly ($640 x 2) against an annual total - likely 'biannual'",
}

/**
 * Annual-sheet bills confirmed to actually be provider utility bills (like
 * Electricity/Gas/Water) rather than fixed recurring payments - imported as
 * a Utility (with an anchor UtilityBill derived from the sheet's Day/Month)
 * instead of a recurring_bills row.
 */
const ANNUAL_BILLS_MANAGED_AS_UTILITIES = new Set(['Phones'])

/**
 * Annual-sheet bills the importer can't categorize on its own - confirmed
 * with the user. "Insurance" and "Home & Property" aren't seeded by
 * category_seeder, so they're created on demand below.
 */
const ANNUAL_BILL_CATEGORIES: Record<string, string> = {
  'Amazon Prime': 'Subscriptions',
  'Bitwarden': 'Subscriptions',
  'Google One': 'Subscriptions',
  'Microsoft 365': 'Subscriptions',
  'Nintendo': 'Subscriptions',
  'VPN': 'Subscriptions',
  'Home Assistant': 'Subscriptions',
  'Telescopius': 'Subscriptions',
  'Manscaped': 'Subscriptions',
  'Costco Membership': 'Groceries',
  'Contents Insurance': 'Insurance',
  'Council Rates': 'Home & Property',
  'Strata Fees': 'Home & Property',
}

/**
 * Rolling-sheet notes already covered by a dedicated sheet imported above -
 * confirmed their values match, so the dedicated sheet wins and these are
 * dropped to avoid duplicates.
 */
const ROLLING_SKIP_NOTES = new Set([
  'Electricity Bill',
  'Gas Bill',
  'Water Bill',
  'Groceries',
  'Takeaway/Eating Out',
  'Transport',
  'Clothing',
  // "Ariel/Brian Allowance" here are VLOOKUPs against Monthly!E19/E20, which
  // are themselves `ROUNDUP(SUM(Brian[Amount]), -1)` / `ROUNDUP(SUM(Ariel[Amount]), -1)`
  // - a ceiling-rounded aggregate of the same line items already imported
  // individually from the Brian/Ariel sheets as personal subscriptions.
  // Importing these as recurring bills too double-counts that spend.
  'Ariel Allowance',
  'Brian Allowance',
])

/**
 * Rolling-sheet notes confirmed (by comparing Budget values across blocks)
 * to be fixed recurring payments rather than variable spend - each maps to
 * the category its recurring_bills row should be tagged with (null = leave
 * uncategorized, e.g. personal allowances that don't fit any category).
 */
const ROLLING_RECURRING_BILL_NOTES: Record<string, string | null> = {
  'Kayo': 'Subscriptions',
  'YouTube': 'Subscriptions',
  'Health Insurance': 'Household',
}

/**
 * Rolling-sheet notes confirmed to be utility-provider bills (billed by a
 * utility the same as Electricity/Gas/Water, even if the amount happens to
 * be mostly flat) rather than fixed recurring payments - each maps to the
 * utility name its monthly actuals should be filed under, mirroring the
 * UTILITY_SHEETS handling above but sourced from Rolling's per-month Actual
 * column instead of a dedicated sheet (these never got their own sheet in
 * the workbook, which is a spreadsheet-management artifact, not a sign they
 * belong with recurring bills instead).
 */
const ROLLING_UTILITY_NOTES: Record<string, string> = {
  'Internet Bill': 'Internet',
  'Phones': 'Phones',
}

/**
 * Remaining Rolling-sheet notes confirmed to be variable/logged spend -
 * each maps to the category its actual entries should be filed under.
 * Anything not listed here falls back to a category named after the note
 * itself, so no data is silently dropped for notes not seen during review.
 */
const ROLLING_CATEGORY_NOTES: Record<string, string> = {
  'Dog': 'Dog',
  'Childcare': 'Childcare',
  'Credit Card': 'Credit Card',
  'Apple Care': 'Household',
  'Strata Insurance': 'Household',
  'Stump removal': 'Household',
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/**
 * The Rolling sheet's Income column has one consolidated figure per month
 * (the workbook never itemized per pay period), so for a fortnightly
 * source that figure is 2-3 pays lumped together - most months 2, plus a
 * 3-pay month a couple of times a year (see `payPeriodsInMonth`). Dividing
 * each month's value by its real pay-period count before taking the median
 * gives the true per-pay-period expected amount instead of a 2-3x inflated
 * one; a monthly source always has exactly 1 period so this is a no-op for
 * it.
 */
function medianPerPayPeriod(
  blocks: RollingIncomeBlock[],
  valueIndex: number,
  cadence: IncomeCadence | undefined
): number {
  const perPeriodValues: number[] = []
  for (const block of blocks) {
    const value = block.values[valueIndex]
    if (value === undefined) continue
    if (!cadence) {
      perPeriodValues.push(value)
      continue
    }
    const periods = payPeriodsInMonth(
      {
        frequency: cadence.frequency,
        payDayOfMonth: cadence.payDayOfMonth ?? null,
        weekendRollback: cadence.weekendRollback ?? false,
        anchorDate: cadence.anchorDate
          ? DateTime.fromISO(cadence.anchorDate, { zone: 'utc' })
          : null,
      } as IncomeSource,
      block.year,
      block.month
    )
    perPeriodValues.push(periods > 0 ? value / periods : value)
  }
  return perPeriodValues.length > 0 ? median(perPeriodValues) : 0
}

/** The ending year of the Jul-Jun Australian financial year an ISO date falls in. */
function financialYearForDate(isoDate: string): number {
  const [year, month] = isoDate.split('-').map(Number) as [number, number]
  return month >= 7 ? year + 1 : year
}

function lastDayOfMonth(year: number, month: number): string {
  return DateTime.utc(year, month, 1).endOf('month').toISODate()!
}

/**
 * Confirmed with the user: as of this import, every bill due in this
 * calendar month has already been paid, even though it's still "current" -
 * update this (or clear it) the next time the importer is re-run once the
 * month has moved on, rather than leaving it stale.
 */
const CONFIRMED_PAID_THROUGH_MONTH = { year: 2026, month: 7 }

/**
 * Whether (year, month) is on or before the confirmed-paid cutoff above -
 * the imported workbook has no "have you paid this" column, but everything
 * before the current month is, in reality, long since paid, and the current
 * month is included too once confirmed. Otherwise the current month is left
 * alone since its checkbox is there to track what's still outstanding.
 */
function isPastBillMonth(year: number, month: number): boolean {
  const today = DateTime.utc()
  if (year < today.year || (year === today.year && month < today.month)) return true
  return year === CONFIRMED_PAID_THROUGH_MONTH.year && month === CONFIRMED_PAID_THROUGH_MONTH.month
}

export default class ImportXlsx extends BaseCommand {
  static commandName = 'import:xlsx'
  static description = 'Import historical data from the Joint Account Workbook xlsx'

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Path to the .xlsx workbook to import' })
  declare file: string

  @flags.boolean({ description: 'Preview counts without writing anything', default: false })
  declare dryRun: boolean

  @flags.boolean({
    description: 'Delete existing rows for the imported tables first',
    default: false,
  })
  declare truncate: boolean

  @flags.number({ description: "Year of the Rolling sheet's first month block", default: 2026 })
  declare rollingStartYear: number

  @flags.number({ description: "Month (1-12) of the Rolling sheet's first block", default: 2 })
  declare rollingStartMonth: number

  /**
   * findOrCreates a category by name and inserts the given actual rows
   * under it. The sheet gives no stable row id, so (category, date, amount,
   * notes) stands in as the natural key - re-running the import without
   * --truncate upserts onto the same rows instead of duplicating them. A
   * real second transaction that happens to match all four fields exactly
   * would collapse into one row, but that's the same reproducibility
   * tradeoff the rest of the importer already makes.
   */
  private async importCategoryActuals(categoryName: string, rows: SimpleActualRow[]) {
    if (rows.length === 0) return

    await db.transaction(async (trx) => {
      const category = await Category.firstOrCreate(
        { name: categoryName },
        { name: categoryName },
        { client: trx }
      )

      if (this.truncate) {
        await CategoryMonthlyActual.query({ client: trx }).where('categoryId', category.id).delete()
      }

      for (const row of rows) {
        const occurredOn = DateTime.fromISO(row.occurredOn, { zone: 'utc' })

        // `updateOrCreate`'s search payload gets passed straight to `.where()`,
        // which binds column values verbatim rather than running them through
        // the column's DateTime -> SQL prepare step - a DateTime instance
        // there makes better-sqlite3 reject the bind param outright, so the
        // lookup needs the already-formatted SQL date string instead.
        const existing = await CategoryMonthlyActual.query({ client: trx })
          .where('categoryId', category.id)
          .where('occurredOn', occurredOn.toISODate()!)
          .where('amount', row.amount)
          .where((query) =>
            row.notes === null ? query.whereNull('notes') : query.where('notes', row.notes)
          )
          .first()

        if (existing) continue

        await CategoryMonthlyActual.create(
          { categoryId: category.id, occurredOn, amount: row.amount, notes: row.notes },
          { client: trx }
        )
      }
    })
  }

  /**
   * Imports the `Non-PAYG Income Tax` sheet's rows as unattributed
   * (`incomeSourceId: null`) income_entries for the given user, plus one
   * income_tax_settings row per financial year the parsed dates fall in
   * (there's normally just one - the sheet only ever covers a single
   * year's rate). (userId, receivedOn, note, amount) stands in as the
   * natural key, same tradeoff as `importCategoryActuals`.
   */
  private async importNonPaygIncome(
    userId: number,
    rows: NonPaygIncomeRow[],
    marginalRate: number | null
  ) {
    if (rows.length === 0) return

    await db.transaction(async (trx) => {
      if (this.truncate) {
        await IncomeEntry.query({ client: trx })
          .where('userId', userId)
          .whereNull('incomeSourceId')
          .delete()
      }

      for (const row of rows) {
        // See importCategoryActuals - a DateTime instance in the search
        // payload breaks better-sqlite3's bind params, so the lookup needs
        // the already-formatted SQL date string instead.
        const existing = await IncomeEntry.query({ client: trx })
          .where('userId', userId)
          .whereNull('incomeSourceId')
          .where('receivedOn', row.occurredOn)
          .where('note', row.item)
          .where('amount', row.saleAmount)
          .first()

        if (existing) continue

        const [year, month] = row.occurredOn.split('-').map(Number) as [number, number]
        await IncomeEntry.create(
          {
            userId,
            incomeSourceId: null,
            year,
            month,
            receivedOn: DateTime.fromISO(row.occurredOn, { zone: 'utc' }),
            amount: row.saleAmount,
            note: row.item,
            taxWithheld: false,
          },
          { client: trx }
        )
      }

      if (marginalRate !== null) {
        const financialYears = new Set(rows.map((row) => financialYearForDate(row.occurredOn)))
        for (const financialYear of financialYears) {
          await IncomeTaxSetting.updateOrCreate(
            { userId, financialYear },
            { marginalRate },
            { client: trx }
          )
        }
      }
    })
  }

  /**
   * Marks CONFIRMED_PAID_THROUGH_MONTH's payment row as paid for every
   * monthly recurring bill, active subscription, and category with an
   * actual logged that month - the same confirmation `isPastBillMonth`
   * applies to utility bills, but utilities set `paid` directly on their
   * bill row while recurring bills/subscriptions/categories track it in a
   * separate payment row that only exists once checked, and the current
   * month intentionally defaults to unpaid otherwise (see
   * standard_month_service's `isPastMonth` fallback) - so it has to be
   * written explicitly rather than falling out of the same date check.
   * Non-monthly bills (quarterly/annual/etc.) have no such per-month
   * checkbox to set, so they're left alone; categories with no actual
   * logged for the month have no checkbox to check either.
   */
  private async markConfirmedPaidThrough() {
    await db.transaction(async (trx) => {
      const monthlyBills = await RecurringBill.query({ client: trx })
        .where('isActive', true)
        .andWhere('isPaused', false)
        .andWhere('isArchived', false)
        .andWhere('frequency', 'monthly')

      for (const bill of monthlyBills) {
        await RecurringBillPayment.updateOrCreate(
          {
            recurringBillId: bill.id,
            year: CONFIRMED_PAID_THROUGH_MONTH.year,
            month: CONFIRMED_PAID_THROUGH_MONTH.month,
          },
          { paid: true },
          { client: trx }
        )
      }

      const subscriptions = await UserSubscription.query({ client: trx })
        .where('isActive', true)
        .andWhere('isPaused', false)
        .andWhere('isArchived', false)
        .andWhere('includeInStandardMonth', true)

      for (const subscription of subscriptions) {
        await SubscriptionPayment.updateOrCreate(
          {
            userSubscriptionId: subscription.id,
            year: CONFIRMED_PAID_THROUGH_MONTH.year,
            month: CONFIRMED_PAID_THROUGH_MONTH.month,
          },
          { paid: true },
          { client: trx }
        )
      }

      // Categories have no per-month checkbox until an actual is logged for
      // that month - only mark the ones with a real actual in the confirmed
      // month, mirroring standard_month_service's own category query.
      const categories = await Category.query({ client: trx })
        .where('isActive', true)
        .andWhere('isPaused', false)
        .andWhere('isArchived', false)
        .andWhere('includeInStandardMonth', true)

      for (const category of categories) {
        const actuals = await CategoryMonthlyActual.query({ client: trx }).where(
          'categoryId',
          category.id
        )
        const hasActualThisMonth = actuals.some(
          (actual) =>
            actual.occurredOn.year === CONFIRMED_PAID_THROUGH_MONTH.year &&
            actual.occurredOn.month === CONFIRMED_PAID_THROUGH_MONTH.month
        )
        if (!hasActualThisMonth) continue

        await CategoryPayment.updateOrCreate(
          {
            categoryId: category.id,
            year: CONFIRMED_PAID_THROUGH_MONTH.year,
            month: CONFIRMED_PAID_THROUGH_MONTH.month,
          },
          { paid: true },
          { client: trx }
        )
      }
    })
  }

  async run() {
    if (!this.file) {
      this.logger.error('Missing required --file flag, e.g. --file="./Joint Account Workbook.xlsx"')
      this.exitCode = 1
      return
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(this.file)

    const utilitiesCategory = await Category.findByOrFail('name', 'Utilities')

    let totalImported = 0

    for (const sheetName of UTILITY_SHEETS) {
      const sheet = workbook.getWorksheet(sheetName)
      if (!sheet) {
        this.logger.warning(`Sheet "${sheetName}" not found - skipping`)
        continue
      }

      const entries = parseMatrixSheet(sheet)
      this.logger.info(`${sheetName}: parsed ${entries.length} monthly bill(s)`)

      if (entries.length > 0) {
        const mostRecent = entries.reduce((latest, entry) =>
          entry.year * 12 + entry.month > latest.year * 12 + latest.month ? entry : latest
        )
        this.logger.info(
          `  most recent: ${mostRecent.year}-${String(mostRecent.month).padStart(2, '0')} = ${mostRecent.amount}`
        )
      }

      if (this.dryRun) continue

      await db.transaction(async (trx) => {
        const utility = await Utility.firstOrCreate(
          { name: sheetName },
          {
            name: sheetName,
            categoryId: utilitiesCategory.id,
            dueOffsetDays: UTILITY_DUE_OFFSET_DAYS[sheetName] ?? null,
          },
          { client: trx }
        )

        if (this.truncate) {
          await UtilityBill.query({ client: trx }).where('utilityId', utility.id).delete()
        }

        for (const entry of entries) {
          await UtilityBill.updateOrCreate(
            { utilityId: utility.id, year: entry.year, month: entry.month },
            {
              amount: entry.amount,
              ...(isPastBillMonth(entry.year, entry.month) ? { paid: true } : {}),
            },
            { client: trx }
          )
        }
      })

      totalImported += entries.length
    }

    const recurringBillsSheet = workbook.getWorksheet('Annual')
    let totalRecurringBills = 0
    if (!recurringBillsSheet) {
      this.logger.warning('Sheet "Annual" not found - skipping')
    } else {
      const rows = parseRecurringBillsSheet(recurringBillsSheet)
      this.logger.info(`Annual: parsed ${rows.length} recurring bill(s)`)

      if (!this.dryRun) {
        await db.transaction(async (trx) => {
          if (this.truncate) {
            await RecurringBill.query({ client: trx }).delete()
          }

          const categoryIdByName = new Map<string, number>()

          for (const row of rows) {
            if (row.dueDay === null || row.dueMonth === null) {
              this.logger.warning(`  "${row.name}" has no parseable Day/Month - skipping`)
              continue
            }

            if (ANNUAL_BILLS_MANAGED_AS_UTILITIES.has(row.name)) {
              // The due date shown is day `dueOffsetDays` of the billing
              // month itself, so the sheet's own due-day doubles as the
              // offset directly. The actual UtilityBill row(s) come from the
              // Rolling sheet below (see ROLLING_UTILITY_NOTES), which has
              // real per-period amounts - this just establishes the Utility
              // shell so those bills have somewhere to land.
              await Utility.firstOrCreate(
                { name: row.name },
                {
                  name: row.name,
                  categoryId: utilitiesCategory.id,
                  frequency: 'annual',
                  dueOffsetDays: row.dueDay,
                },
                { client: trx }
              )

              this.logger.info(`  "${row.name}" is managed as a Utility - skipping recurring bill`)
              continue
            }

            const categoryName = ANNUAL_BILL_CATEGORIES[row.name]
            let categoryId: number | null = null
            if (categoryName) {
              categoryId = categoryIdByName.get(categoryName) ?? null
              if (categoryId === null) {
                const category = await Category.firstOrCreate(
                  { name: categoryName },
                  { name: categoryName },
                  { client: trx }
                )
                categoryId = category.id
                categoryIdByName.set(categoryName, categoryId)
              }
            }

            await RecurringBill.updateOrCreate(
              { name: row.name },
              {
                name: row.name,
                amount: row.amount,
                frequency: 'annual',
                dueDay: row.dueDay,
                dueMonth: row.dueMonth,
                categoryId,
              },
              { client: trx }
            )
          }
        })
      }

      totalRecurringBills = rows.length

      for (const row of rows) {
        const note = FREQUENCY_CORRECTIONS[row.name]
        if (note) {
          this.logger.warning(`  "${row.name}" ${note} - review its frequency after import`)
        }
      }
    }

    const subscriptionsCategory = await Category.findByOrFail('name', 'Subscriptions')

    let totalSubscriptions = 0
    for (const sheetName of SUBSCRIPTION_SHEETS) {
      const sheet = workbook.getWorksheet(sheetName)
      if (!sheet) {
        this.logger.warning(`Sheet "${sheetName}" not found - skipping`)
        continue
      }

      const user = await User.findBy('fullName', sheetName)
      if (!user) {
        this.logger.error(
          `No user found with full_name "${sheetName}" - seed users before importing`
        )
        this.exitCode = 1
        return
      }

      const rows = parseUserItemSheet(sheet)
      const total = rows.reduce((sum, row) => sum + row.amount, 0)
      this.logger.info(
        `${sheetName}: parsed ${rows.length} subscription(s), total $${total.toFixed(2)}`
      )

      if (!this.dryRun) {
        await db.transaction(async (trx) => {
          if (this.truncate) {
            await UserSubscription.query({ client: trx }).where('userId', user.id).delete()
          }

          for (const row of rows) {
            await UserSubscription.updateOrCreate(
              { userId: user.id, name: row.name },
              {
                amount: row.amount,
                dayOfMonth: row.dayOfMonth,
                categoryId: subscriptionsCategory.id,
              },
              { client: trx }
            )
          }
        })
      }

      totalSubscriptions += rows.length
    }

    let totalCategoryActuals = 0

    const foodSheet = workbook.getWorksheet('Food')
    if (!foodSheet) {
      this.logger.warning('Sheet "Food" not found - skipping')
    } else {
      const { groceries, takeaways } = parseFoodSheet(foodSheet)
      this.logger.info(
        `Food: parsed ${groceries.length} Groceries + ${takeaways.length} Takeaway entries`
      )
      if (!this.dryRun) {
        await this.importCategoryActuals('Groceries', groceries)
        await this.importCategoryActuals('Takeaway/Eating Out', takeaways)
      }
      totalCategoryActuals += groceries.length + takeaways.length
    }

    for (const { sheet: sheetName, category: categoryName } of CATEGORY_ACTUAL_SHEETS) {
      const sheet = workbook.getWorksheet(sheetName)
      if (!sheet) {
        this.logger.warning(`Sheet "${sheetName}" not found - skipping`)
        continue
      }

      const rows = parseSimpleActualsSheet(sheet)
      this.logger.info(`${sheetName}: parsed ${rows.length} entries`)
      if (!this.dryRun) {
        await this.importCategoryActuals(categoryName, rows)
      }
      totalCategoryActuals += rows.length
    }

    const amberSheet = workbook.getWorksheet('Amber')
    if (!amberSheet) {
      this.logger.warning('Sheet "Amber" not found - skipping')
    } else {
      const items = parseUserItemSheet(amberSheet)
      const total = items.reduce((sum, item) => sum + item.amount, 0)
      this.logger.info(
        `Amber: parsed ${items.length} cost item(s), total $${total.toFixed(2)} - seeding "Dog" category budget + itemized breakdown`
      )

      if (!this.dryRun) {
        await db.transaction(async (trx) => {
          const dogCategory = await Category.firstOrCreate(
            { name: 'Dog' },
            { name: 'Dog' },
            { client: trx }
          )
          dogCategory.budgetAmount = total
          await dogCategory.save()

          if (this.truncate) {
            await CategoryBudgetItem.query({ client: trx })
              .where('categoryId', dogCategory.id)
              .delete()
          }

          for (const item of items) {
            await CategoryBudgetItem.updateOrCreate(
              { categoryId: dogCategory.id, name: item.name },
              {
                amount: item.amount,
                notes: item.dayOfMonth ? `Day ${item.dayOfMonth}` : null,
              },
              { client: trx }
            )
          }
        })
      }
    }

    let totalRollingRecurringBills = 0
    let totalRollingUtilityBills = 0
    let totalDueDateCorrections = 0
    let totalIncomeEntries = 0
    let totalCarryoversImported = 0
    const rollingSheet = workbook.getWorksheet('Rolling')
    if (!rollingSheet) {
      this.logger.warning('Sheet "Rolling" not found - skipping')
    } else {
      const { entries: rollingEntries, income: rollingIncome } = parseRollingSheet(
        rollingSheet,
        this.rollingStartYear,
        this.rollingStartMonth
      )

      const existingRecurringBills = await RecurringBill.query().select('id', 'name', 'frequency')
      const existingRecurringBillsByName = new Map(
        existingRecurringBills.map((bill) => [bill.name, bill])
      )

      const byNote = new Map<string, typeof rollingEntries>()
      const rollingRecurringBillMatches = new Map<string, typeof rollingEntries>()
      for (const entry of rollingEntries) {
        if (ROLLING_SKIP_NOTES.has(entry.note)) continue
        if (existingRecurringBillsByName.has(entry.note)) {
          const bucket = rollingRecurringBillMatches.get(entry.note) ?? []
          bucket.push(entry)
          rollingRecurringBillMatches.set(entry.note, bucket)
          continue
        }
        const bucket = byNote.get(entry.note) ?? []
        bucket.push(entry)
        byNote.set(entry.note, bucket)
      }

      for (const [note, noteEntries] of byNote) {
        if (note in ROLLING_UTILITY_NOTES) {
          const utilityName = ROLLING_UTILITY_NOTES[note]!
          const actualRows = noteEntries.filter((entry) => entry.actual !== null)

          this.logger.info(
            `Rolling: "${note}" -> utility "${utilityName}", ${actualRows.length} monthly actual(s)`
          )

          if (!this.dryRun) {
            await db.transaction(async (trx) => {
              const utility = await Utility.firstOrCreate(
                { name: utilityName },
                {
                  name: utilityName,
                  categoryId: utilitiesCategory.id,
                  frequency: 'monthly',
                  dueOffsetDays: UTILITY_DUE_OFFSET_DAYS[utilityName] ?? null,
                },
                { client: trx }
              )

              if (this.truncate) {
                await UtilityBill.query({ client: trx }).where('utilityId', utility.id).delete()
              }

              for (const entry of actualRows) {
                await UtilityBill.updateOrCreate(
                  { utilityId: utility.id, year: entry.year, month: entry.month },
                  {
                    amount: entry.actual!,
                    ...(isPastBillMonth(entry.year, entry.month) ? { paid: true } : {}),
                  },
                  { client: trx }
                )
              }
            })
          }

          totalRollingUtilityBills += actualRows.length
        } else if (note in ROLLING_RECURRING_BILL_NOTES) {
          const categoryName = ROLLING_RECURRING_BILL_NOTES[note]
          const latest = noteEntries[noteEntries.length - 1]!
          const amount = latest.budget ?? latest.actual ?? 0
          const dueDay = latest.dayOfMonth

          this.logger.info(
            `Rolling: "${note}" -> recurring bill, $${amount} monthly${dueDay ? ` (day ${dueDay})` : ''}`
          )

          if (!this.dryRun) {
            await db.transaction(async (trx) => {
              let categoryId: number | null = null
              if (categoryName) {
                const category = await Category.firstOrCreate(
                  { name: categoryName },
                  { name: categoryName },
                  { client: trx }
                )
                categoryId = category.id
              }

              await RecurringBill.updateOrCreate(
                { name: note },
                {
                  name: note,
                  categoryId,
                  amount,
                  frequency: 'monthly',
                  dueDay,
                  dueMonth: null,
                },
                { client: trx }
              )
            })
          }

          totalRollingRecurringBills += 1
        } else {
          const categoryName = ROLLING_CATEGORY_NOTES[note] ?? note
          const rows: SimpleActualRow[] = noteEntries
            .filter((entry) => entry.actual !== null)
            .map((entry) => ({
              occurredOn: lastDayOfMonth(entry.year, entry.month),
              amount: entry.actual!,
              notes: null,
            }))

          this.logger.info(
            `Rolling: "${note}" -> category actuals under "${categoryName}" (${rows.length} entries)`
          )

          if (!this.dryRun) {
            await this.importCategoryActuals(categoryName, rows)
          }

          totalCategoryActuals += rows.length
        }
      }

      // Bills imported from Annual already exist in recurring_bills by the
      // time Rolling is processed, so their entries land here instead of
      // byNote above. Rolling records the day they were *actually* paid
      // that month, which is more trustworthy than the Annual sheet's own
      // static "Next" column - use it to correct due_day/due_month for
      // whichever bills happen to fall in Rolling's Feb-Sep window. Bills
      // outside that window keep the day/month already parsed from the
      // Annual sheet above.
      for (const [name, matchEntries] of rollingRecurringBillMatches) {
        const bill = existingRecurringBillsByName.get(name)
        const confirmed = [...matchEntries].reverse().find((entry) => entry.dayOfMonth !== null)
        if (!bill || !confirmed || confirmed.dayOfMonth === null) continue

        this.logger.info(
          `Rolling: confirmed "${name}" actually due day ${confirmed.dayOfMonth} of month ${confirmed.month}`
        )

        if (!this.dryRun) {
          bill.merge({ dueDay: confirmed.dayOfMonth, dueMonth: confirmed.month })
          await bill.save()
        }
        totalDueDateCorrections += 1
      }

      // The Income column has 2-4 sparse, unlabeled values per block. Position
      // is the only signal available: the 1st value is stable (~$3885-4684)
      // and the 2nd recurs at exactly $2607.82 in 4 of 6 blocks, suggesting
      // they're two people's regular pay in consistent sheet order - so they
      // seed one income_source per user (in seeded id order: Brian, Ariel).
      // Anything beyond the 2nd value per block isn't a third paycheck - it's
      // the bank balance left over from the prior month, so it's summed into
      // that month's carryover figure rather than treated as income.
      const users = await User.query().orderBy('id', 'asc')
      const [primaryUser, secondaryUser] = users
      if (!primaryUser || !secondaryUser) {
        this.logger.warning('Fewer than 2 users seeded - skipping income import')
      } else {
        const primaryCadence = INCOME_CADENCE[primaryUser.fullName ?? '']
        const secondaryCadence = INCOME_CADENCE[secondaryUser.fullName ?? '']

        this.logger.info(
          `Rolling: parsed income for ${rollingIncome.length} month(s), seeding income sources for ${primaryUser.fullName}/${secondaryUser.fullName}`
        )

        if (!this.dryRun) {
          await db.transaction(async (trx) => {
            // One-time in-place rename from either of the old names
            // ("${fullName} Income", then "Paycheque") to MAIN_SALARY_NAME,
            // so a re-import reuses the existing source (and its
            // entries/history) instead of creating an orphaned duplicate
            // under the new name.
            for (const user of [primaryUser, secondaryUser]) {
              await IncomeSource.query({ client: trx })
                .where('userId', user.id)
                .whereIn('name', [`${user.fullName} Income`, 'Paycheque'])
                .update({ name: MAIN_SALARY_NAME })
            }

            const primarySource = await IncomeSource.updateOrCreate(
              { userId: primaryUser.id, name: MAIN_SALARY_NAME },
              {
                expectedAmount: medianPerPayPeriod(rollingIncome, 0, primaryCadence),
                ...(primaryCadence && {
                  frequency: primaryCadence.frequency,
                  payDayOfMonth: primaryCadence.payDayOfMonth ?? null,
                  weekendRollback: primaryCadence.weekendRollback ?? false,
                  anchorDate: primaryCadence.anchorDate
                    ? DateTime.fromISO(primaryCadence.anchorDate, { zone: 'utc' })
                    : null,
                }),
              },
              { client: trx }
            )
            const secondarySource = await IncomeSource.updateOrCreate(
              { userId: secondaryUser.id, name: MAIN_SALARY_NAME },
              {
                expectedAmount: medianPerPayPeriod(rollingIncome, 1, secondaryCadence),
                ...(secondaryCadence && {
                  frequency: secondaryCadence.frequency,
                  payDayOfMonth: secondaryCadence.payDayOfMonth ?? null,
                  weekendRollback: secondaryCadence.weekendRollback ?? false,
                  anchorDate: secondaryCadence.anchorDate
                    ? DateTime.fromISO(secondaryCadence.anchorDate, { zone: 'utc' })
                    : null,
                }),
              },
              { client: trx }
            )

            if (this.truncate) {
              await IncomeEntry.query({ client: trx })
                .whereIn('incomeSourceId', [primarySource.id, secondarySource.id])
                .delete()
              for (const block of rollingIncome) {
                await MonthCarryover.query({ client: trx })
                  .where('year', block.year)
                  .where('month', block.month)
                  .delete()
              }
            }

            // The Rolling sheet's Income column has one consolidated figure
            // per month - split it into one real IncomeEntry per actual
            // payday (2, or 3 in the rare month) rather than importing it
            // as a single lump sum, so the Income/Monthly pages show each
            // pay separately instead of a frontend having to re-derive the
            // split from a combined number.
            async function seedIncomeEntries(
              source: IncomeSource,
              userId: number,
              block: RollingIncomeBlock,
              rawAmount: number
            ): Promise<number> {
              const dates = payDatesInMonth(source, block.year, block.month)
              if (dates.length === 0) {
                await IncomeEntry.updateOrCreate(
                  { incomeSourceId: source.id, year: block.year, month: block.month },
                  { userId, amount: round(rawAmount) },
                  { client: trx }
                )
                return 1
              }
              const perPeriod = round(rawAmount / dates.length)
              for (const date of dates) {
                // Mirrors the CategoryMonthlyActual lookup above - a date
                // column in `updateOrCreate`'s search payload gets bound
                // straight to `.where()`, skipping the DateTime -> SQL
                // prepare step, so the lookup needs the formatted string
                // and a manual find-then-write instead.
                const existing = await IncomeEntry.query({ client: trx })
                  .where('incomeSourceId', source.id)
                  .where('year', block.year)
                  .where('month', block.month)
                  .where('receivedOn', date.toISODate()!)
                  .first()

                if (existing) {
                  existing.merge({ userId, amount: perPeriod })
                  await existing.useTransaction(trx).save()
                } else {
                  await IncomeEntry.create(
                    {
                      incomeSourceId: source.id,
                      year: block.year,
                      month: block.month,
                      userId,
                      amount: perPeriod,
                      receivedOn: date,
                    },
                    { client: trx }
                  )
                }
              }
              return dates.length
            }

            for (const block of rollingIncome) {
              if (block.values[0] !== undefined) {
                totalIncomeEntries += await seedIncomeEntries(
                  primarySource,
                  primaryUser.id,
                  block,
                  block.values[0]
                )
              }
              if (block.values[1] !== undefined) {
                totalIncomeEntries += await seedIncomeEntries(
                  secondarySource,
                  secondaryUser.id,
                  block,
                  block.values[1]
                )
              }

              const leftover = block.values.slice(2)
              if (leftover.length > 0) {
                await MonthCarryover.updateOrCreate(
                  { year: block.year, month: block.month },
                  { amount: leftover.reduce((sum, amount) => sum + amount, 0) },
                  { client: trx }
                )
                totalCarryoversImported += leftover.length
              }
            }
          })
        } else {
          totalIncomeEntries = rollingIncome.reduce(
            (sum, block) => sum + Math.min(block.values.length, 2),
            0
          )
          totalCarryoversImported = rollingIncome.reduce(
            (sum, block) => sum + Math.max(block.values.length - 2, 0),
            0
          )
        }
      }
    }

    // Brian-only, per the household - the sheet has never tracked Ariel's
    // non-PAYG income.
    const nonPaygSheet = workbook.getWorksheet('Non-PAYG Income Tax')
    let totalNonPaygItems = 0
    if (!nonPaygSheet) {
      this.logger.warning('Sheet "Non-PAYG Income Tax" not found - skipping')
    } else {
      const { rows: nonPaygRows, marginalRate } = parseNonPaygIncomeSheet(nonPaygSheet)
      this.logger.info(
        `Non-PAYG Income Tax: parsed ${nonPaygRows.length} item(s), marginal rate ${marginalRate ?? 'not set'}`
      )

      const brian = await User.findByOrFail('fullName', 'Brian')
      if (!this.dryRun) {
        await this.importNonPaygIncome(brian.id, nonPaygRows, marginalRate)
      }
      totalNonPaygItems = nonPaygRows.length
    }

    if (this.dryRun) {
      this.logger.success('Dry run complete - no changes written')
    } else {
      await this.markConfirmedPaidThrough()
      this.logger.success(
        `Imported ${totalImported + totalRollingUtilityBills} utility bill entries, ${totalRecurringBills + totalRollingRecurringBills} recurring bills (${totalDueDateCorrections} due dates confirmed against Rolling), ${totalSubscriptions} personal subscriptions, ${totalCategoryActuals} category actuals, ${totalIncomeEntries} income entries, ${totalNonPaygItems} non-PAYG income item(s), and ${totalCarryoversImported} carryover balance(s)`
      )
    }
  }
}
