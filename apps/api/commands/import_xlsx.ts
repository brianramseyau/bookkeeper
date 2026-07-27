import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import RecurringBill from '#models/recurring_bill'
import User from '#models/user'
import UserSubscription from '#models/user_subscription'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import CategoryBudgetItem from '#models/category_budget_item'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import MonthCarryover from '#models/month_carryover'
import { parseMatrixSheet } from '#services/import/parse_matrix_sheet'
import { parseRecurringBillsSheet } from '#services/import/parse_recurring_bills_sheet'
import { parseUserItemSheet } from '#services/import/parse_user_item_sheet'
import {
  parseSimpleActualsSheet,
  type SimpleActualRow,
} from '#services/import/parse_simple_actuals_sheet'
import { parseFoodSheet } from '#services/import/parse_food_sheet'
import { parseRollingSheet } from '#services/import/parse_rolling_sheet'

/** Sheet name -> utility name. */
const UTILITY_SHEETS = ['Electricity', 'Gas', 'Water']

/**
 * Days after the billing period end that each utility's bill is due -
 * confirmed with the user, since the workbook has no column for this.
 */
const UTILITY_DUE_OFFSET_DAYS: Record<string, number> = {
  Electricity: 13,
  Gas: 16,
  Water: 28,
}

/** Sheet name -> user full_name. Each sheet lists that person's personal subscriptions. */
const SUBSCRIPTION_SHEETS = ['Brian', 'Ariel']

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
  'Ariel Allowance': null,
  'Brian Allowance': null,
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function lastDayOfMonth(year: number, month: number): string {
  return DateTime.utc(year, month, 1).endOf('month').toISODate()!
}

function nextMonthlyOccurrence(dayOfMonth: number): DateTime {
  const today = DateTime.utc().startOf('day')
  let candidate = today.set({ day: Math.min(dayOfMonth, today.daysInMonth) })
  if (candidate < today) {
    candidate = candidate.plus({ months: 1 })
    candidate = candidate.set({ day: Math.min(dayOfMonth, candidate.daysInMonth) })
  }
  return candidate
}

/**
 * Rolls a recurring day/month pattern forward from anchorYear until it
 * lands on or after today - the sheets only ever capture a due date as of
 * whenever they were last edited, so importing it verbatim produces a
 * stale (often "overdue by months") next_due_on.
 */
function advanceToFutureOccurrence(
  dueDay: number,
  dueMonth: number,
  frequency: string,
  customIntervalValue: number | null,
  customIntervalUnit: string | null,
  anchorYear: number
): DateTime {
  const today = DateTime.utc().startOf('day')
  const stepMonths =
    frequency === 'custom'
      ? customIntervalUnit === 'months'
        ? (customIntervalValue ?? 1)
        : null
      : ({ monthly: 1, quarterly: 3, biannual: 6, annual: 12 }[frequency] ?? 12)
  const stepDays =
    frequency === 'custom' && customIntervalUnit !== 'months'
      ? customIntervalUnit === 'weeks'
        ? (customIntervalValue ?? 4) * 7
        : (customIntervalValue ?? 30)
      : null

  let candidate = DateTime.utc(anchorYear, dueMonth, 1).set({
    day: Math.min(dueDay, DateTime.utc(anchorYear, dueMonth).daysInMonth ?? 28),
  })
  while (candidate < today) {
    candidate =
      stepMonths !== null
        ? candidate.plus({ months: stepMonths })
        : candidate.plus({ days: stepDays! })
    candidate = candidate.set({ day: Math.min(dueDay, candidate.daysInMonth ?? 28) })
  }
  return candidate
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
   * under it. category_monthly_actuals intentionally has no unique
   * constraint (corrections are just new rows), so re-running this without
   * --truncate duplicates data - that's expected for a one-time import.
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
        await CategoryMonthlyActual.create(
          {
            categoryId: category.id,
            occurredOn: DateTime.fromISO(row.occurredOn, { zone: 'utc' }),
            amount: row.amount,
            notes: row.notes,
          },
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
            { amount: entry.amount },
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

            // The sheet's own "Next" date is only correct as of whenever it
            // was last edited - roll the day/month pattern it captures
            // forward to a genuinely future date instead of importing it
            // verbatim (see the Rolling-sheet cross-reference below, which
            // overrides this with a confirmed date where one exists).
            const nextDueOn = advanceToFutureOccurrence(
              row.dueDay,
              row.dueMonth,
              'annual',
              null,
              null,
              row.dueYear ?? DateTime.utc().year
            )

            if (ANNUAL_BILLS_MANAGED_AS_UTILITIES.has(row.name)) {
              // Due date = (billing month's end) + dueOffsetDays always lands
              // on day `dueOffsetDays` of the following month, so the day
              // component of the due date doubles as the offset. The actual
              // UtilityBill row(s) come from the Rolling sheet below (see
              // ROLLING_UTILITY_NOTES), which has real per-period amounts -
              // this just establishes the Utility shell so those bills have
              // somewhere to land.
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
                dueYear: row.dueYear,
                nextDueOn,
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

      const existingRecurringBills = await RecurringBill.query().select(
        'id',
        'name',
        'frequency',
        'customIntervalValue',
        'customIntervalUnit'
      )
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
                { name: utilityName, categoryId: utilitiesCategory.id, frequency: 'monthly' },
                { client: trx }
              )

              if (this.truncate) {
                await UtilityBill.query({ client: trx }).where('utilityId', utility.id).delete()
              }

              for (const entry of actualRows) {
                await UtilityBill.updateOrCreate(
                  { utilityId: utility.id, year: entry.year, month: entry.month },
                  { amount: entry.actual! },
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
                  dueYear: null,
                  nextDueOn: dueDay ? nextMonthlyOccurrence(dueDay) : null,
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
      // static "Next" column - use it to correct due_day/due_month/
      // next_due_on for whichever bills happen to fall in Rolling's
      // Feb-Sep window. Bills outside that window keep the forward-rolled
      // date already computed from the Annual sheet above.
      for (const [name, matchEntries] of rollingRecurringBillMatches) {
        const bill = existingRecurringBillsByName.get(name)
        const confirmed = [...matchEntries].reverse().find((entry) => entry.dayOfMonth !== null)
        if (!bill || !confirmed || confirmed.dayOfMonth === null) continue

        const nextDueOn = advanceToFutureOccurrence(
          confirmed.dayOfMonth,
          confirmed.month,
          bill.frequency,
          bill.customIntervalValue,
          bill.customIntervalUnit,
          confirmed.year
        )

        this.logger.info(
          `Rolling: confirmed "${name}" actually due day ${confirmed.dayOfMonth} of month ${confirmed.month} - next due ${nextDueOn.toISODate()}`
        )

        if (!this.dryRun) {
          bill.merge({ dueDay: confirmed.dayOfMonth, dueMonth: confirmed.month, nextDueOn })
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
        const primaryValues = rollingIncome
          .map((block) => block.values[0])
          .filter((v) => v !== undefined)
        const secondaryValues = rollingIncome
          .map((block) => block.values[1])
          .filter((v) => v !== undefined)

        this.logger.info(
          `Rolling: parsed income for ${rollingIncome.length} month(s), seeding income sources for ${primaryUser.fullName}/${secondaryUser.fullName}`
        )

        if (!this.dryRun) {
          await db.transaction(async (trx) => {
            const primarySource = await IncomeSource.updateOrCreate(
              { userId: primaryUser.id, name: `${primaryUser.fullName} Income` },
              { expectedAmount: primaryValues.length > 0 ? median(primaryValues) : 0 },
              { client: trx }
            )
            const secondarySource = await IncomeSource.updateOrCreate(
              { userId: secondaryUser.id, name: `${secondaryUser.fullName} Income` },
              { expectedAmount: secondaryValues.length > 0 ? median(secondaryValues) : 0 },
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

            for (const block of rollingIncome) {
              for (const [index, amount] of block.values.entries()) {
                if (index === 0) {
                  await IncomeEntry.create(
                    {
                      incomeSourceId: primarySource.id,
                      userId: primaryUser.id,
                      year: block.year,
                      month: block.month,
                      amount,
                    },
                    { client: trx }
                  )
                  totalIncomeEntries += 1
                } else if (index === 1) {
                  await IncomeEntry.create(
                    {
                      incomeSourceId: secondarySource.id,
                      userId: secondaryUser.id,
                      year: block.year,
                      month: block.month,
                      amount,
                    },
                    { client: trx }
                  )
                  totalIncomeEntries += 1
                } else {
                  const existing = await MonthCarryover.query({ client: trx })
                    .where('year', block.year)
                    .where('month', block.month)
                    .first()
                  await MonthCarryover.updateOrCreate(
                    { year: block.year, month: block.month },
                    { amount: (existing?.amount ?? 0) + amount },
                    { client: trx }
                  )
                  totalCarryoversImported += 1
                }
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

    if (this.dryRun) {
      this.logger.success('Dry run complete - no changes written')
    } else {
      this.logger.success(
        `Imported ${totalImported + totalRollingUtilityBills} utility bill entries, ${totalRecurringBills + totalRollingRecurringBills} recurring bills (${totalDueDateCorrections} due dates confirmed against Rolling), ${totalSubscriptions} personal subscriptions, ${totalCategoryActuals} category actuals, ${totalIncomeEntries} income entries, and ${totalCarryoversImported} carryover balance(s)`
      )
    }
  }
}
