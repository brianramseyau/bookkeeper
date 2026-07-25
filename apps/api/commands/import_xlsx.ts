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
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
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
  'Internet Bill': 'Household',
  'Health Insurance': 'Household',
  'Ariel Allowance': null,
  'Brian Allowance': null,
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
          { name: sheetName, categoryId: utilitiesCategory.id },
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

          for (const row of rows) {
            await RecurringBill.updateOrCreate(
              { name: row.name },
              {
                name: row.name,
                amount: row.amount,
                frequency: 'annual',
                dueDay: row.dueDay,
                dueMonth: row.dueMonth,
                dueYear: row.dueYear,
                nextDueOn: row.nextDueOn ? DateTime.fromISO(row.nextDueOn, { zone: 'utc' }) : null,
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
              { amount: row.amount, dayOfMonth: row.dayOfMonth },
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
        `Amber: parsed ${items.length} cost item(s), total $${total.toFixed(2)} - seeding "Dog" category budget`
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
        })
      }
    }

    let totalRollingRecurringBills = 0
    let totalIncomeEntries = 0
    const rollingSheet = workbook.getWorksheet('Rolling')
    if (!rollingSheet) {
      this.logger.warning('Sheet "Rolling" not found - skipping')
    } else {
      const { entries: rollingEntries, income: rollingIncome } = parseRollingSheet(
        rollingSheet,
        this.rollingStartYear,
        this.rollingStartMonth
      )

      const existingRecurringBills = await RecurringBill.query().select('name')
      const existingRecurringBillNames = new Set(existingRecurringBills.map((bill) => bill.name))

      const byNote = new Map<string, typeof rollingEntries>()
      for (const entry of rollingEntries) {
        if (ROLLING_SKIP_NOTES.has(entry.note)) continue
        if (existingRecurringBillNames.has(entry.note)) continue
        const bucket = byNote.get(entry.note) ?? []
        bucket.push(entry)
        byNote.set(entry.note, bucket)
      }

      for (const [note, noteEntries] of byNote) {
        if (note in ROLLING_RECURRING_BILL_NOTES) {
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

      // The Income column has 2-4 sparse, unlabeled values per block. Position
      // is the only signal available: the 1st value is stable (~$3885-4684)
      // and the 2nd recurs at exactly $2607.82 in 4 of 6 blocks, suggesting
      // they're two people's regular pay in consistent sheet order - so they
      // seed one income_source per user (in seeded id order: Brian, Ariel).
      // Anything beyond the 2nd value per block (bonuses, extra pay cycles)
      // is imported unattributed rather than guessed.
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
                .orWhereNull('incomeSourceId')
                .delete()
            }

            for (const block of rollingIncome) {
              for (const [index, amount] of block.values.entries()) {
                const incomeSourceId =
                  index === 0 ? primarySource.id : index === 1 ? secondarySource.id : null
                const userId = index === 0 ? primaryUser.id : index === 1 ? secondaryUser.id : null

                await IncomeEntry.create(
                  {
                    incomeSourceId,
                    userId,
                    year: block.year,
                    month: block.month,
                    amount,
                    note: incomeSourceId === null ? 'Rolling import - additional income' : null,
                  },
                  { client: trx }
                )
                totalIncomeEntries += 1
              }
            }
          })
        } else {
          totalIncomeEntries = rollingIncome.reduce((sum, block) => sum + block.values.length, 0)
        }
      }
    }

    if (this.dryRun) {
      this.logger.success('Dry run complete - no changes written')
    } else {
      this.logger.success(
        `Imported ${totalImported} utility bill entries, ${totalRecurringBills + totalRollingRecurringBills} recurring bills, ${totalSubscriptions} personal subscriptions, ${totalCategoryActuals} category actuals, and ${totalIncomeEntries} income entries`
      )
    }
  }
}
