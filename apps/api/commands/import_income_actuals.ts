import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExcelJS from 'exceljs'
import { DateTime } from 'luxon'
import User from '#models/user'
import IncomeSource from '#models/income_source'
import IncomeEntry from '#models/income_entry'
import MonthCarryover from '#models/month_carryover'
import { parseRollingSheet } from '#services/import/parse_rolling_sheet'
import { payDatesInMonth } from '#services/income_cadence'

/**
 * One-time backfill of real income_entries from the original workbook's
 * Rolling sheet, run after the app learned to model income by real pay
 * cadence (monthly vs. fortnightly) instead of one lump sum per calendar
 * month.
 *
 * The Rolling sheet's Income column is a sparse, unlabeled list of values
 * per month block: the first value is the primary user's monthly pay, the
 * second is the secondary user's pay for that month (a single recorded
 * figure, not one row per fortnightly payment - the sheet never broke her
 * pay down further), and anything beyond that is the household's carried-
 * over balance from the prior month, matching the original import's own
 * handling of this column. This command only adds a real computed payday
 * (`receivedOn`) to the first two values via each source's cadence -
 * it does not change what those values represent.
 *
 * Only backfills months up to and including the current month - later
 * blocks in the sheet are forward projections, not real deposits.
 */
export default class ImportIncomeActuals extends BaseCommand {
  static commandName = 'import:income-actuals'
  static description =
    "Backfill real income_entries and carryover from the workbook's Rolling sheet, with a computed payday per entry"

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'Path to the .xlsx workbook to import' })
  declare file: string

  @flags.boolean({ description: 'Preview counts without writing anything', default: false })
  declare dryRun: boolean

  @flags.number({ description: "Year of the Rolling sheet's first month block", default: 2026 })
  declare rollingStartYear: number

  @flags.number({ description: "Month (1-12) of the Rolling sheet's first block", default: 2 })
  declare rollingStartMonth: number

  async run() {
    if (!this.file) {
      this.logger.error('Missing required --file flag, e.g. --file="./Joint Account Workbook.xlsx"')
      this.exitCode = 1
      return
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(this.file)

    const sheet = workbook.getWorksheet('Rolling')
    if (!sheet) {
      this.logger.error('No "Rolling" sheet found in the workbook')
      this.exitCode = 1
      return
    }

    const { income } = parseRollingSheet(sheet, this.rollingStartYear, this.rollingStartMonth)

    const users = await User.query().orderBy('id', 'asc')
    const [primaryUser, secondaryUser] = users
    if (!primaryUser || !secondaryUser) {
      this.logger.error('Fewer than 2 users seeded - aborting')
      this.exitCode = 1
      return
    }

    const primarySource = await IncomeSource.query()
      .where('userId', primaryUser.id)
      .andWhere('name', `${primaryUser.fullName} Income`)
      .first()
    const secondarySource = await IncomeSource.query()
      .where('userId', secondaryUser.id)
      .andWhere('name', `${secondaryUser.fullName} Income`)
      .first()
    if (!primarySource || !secondarySource) {
      this.logger.error('Could not find the expected "<Name> Income" sources - aborting')
      this.exitCode = 1
      return
    }

    const now = DateTime.now()
    let entriesCreated = 0
    let carryoversCreated = 0
    const skipped: string[] = []

    for (const block of income) {
      if (block.year * 12 + block.month > now.year * 12 + now.month) continue
      if (block.values.length === 0) continue

      const [primaryAmount, secondaryAmount, ...carryoverValues] = block.values

      const createIfMissing = async (source: IncomeSource, user: User, amount: number) => {
        const existing = await IncomeEntry.query()
          .where('incomeSourceId', source.id)
          .where('year', block.year)
          .where('month', block.month)
        if (existing.length > 0) {
          skipped.push(`${user.fullName} ${block.year}-${block.month} (entry already exists)`)
          return
        }
        const [payDate] = payDatesInMonth(source, block.year, block.month)
        this.logger.info(
          `${user.fullName} ${block.year}-${block.month}: ${amount} on ${payDate?.toISODate() ?? 'unknown date'}`
        )
        if (!this.dryRun) {
          await IncomeEntry.create({
            incomeSourceId: source.id,
            year: block.year,
            month: block.month,
            amount,
            receivedOn: payDate ?? null,
          })
        }
        entriesCreated += 1
      }

      if (primaryAmount !== undefined)
        await createIfMissing(primarySource, primaryUser, primaryAmount)
      if (secondaryAmount !== undefined) {
        await createIfMissing(secondarySource, secondaryUser, secondaryAmount)
      }

      const carryoverAmount = Math.round(carryoverValues.reduce((sum, v) => sum + v, 0) * 100) / 100
      if (carryoverAmount > 0) {
        const existing = await MonthCarryover.query()
          .where('year', block.year)
          .where('month', block.month)
          .first()
        if (existing) {
          skipped.push(`Carryover ${block.year}-${block.month} (row already exists)`)
        } else {
          this.logger.info(`Carryover ${block.year}-${block.month}: ${carryoverAmount}`)
          if (!this.dryRun) {
            await MonthCarryover.create({
              year: block.year,
              month: block.month,
              amount: carryoverAmount,
            })
          }
          carryoversCreated += 1
        }
      }
    }

    for (const message of skipped) {
      this.logger.warning(`Skipped ${message}`)
    }

    if (this.dryRun) {
      this.logger.success(
        `Dry run: would create ${entriesCreated} income entries and ${carryoversCreated} carryover row(s)`
      )
    } else {
      this.logger.success(
        `Created ${entriesCreated} income entries and ${carryoversCreated} carryover row(s)`
      )
    }
  }
}
