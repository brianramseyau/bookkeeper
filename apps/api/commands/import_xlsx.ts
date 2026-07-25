import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ExcelJS from 'exceljs'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import { parseMatrixSheet } from '#services/import/parse_matrix_sheet'

/**
 * Sheet name -> utility name. Only these sheets are handled so far; later
 * phases add parsers (and this map) for Annual/Brian/Ariel/Food/etc.
 */
const UTILITY_SHEETS = ['Electricity', 'Gas', 'Water']

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
    description: 'Delete existing utility_bills for the imported utilities first',
    default: false,
  })
  declare truncate: boolean

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

    if (this.dryRun) {
      this.logger.success('Dry run complete - no changes written')
    } else {
      this.logger.success(`Imported ${totalImported} utility bill entries`)
    }
  }
}
