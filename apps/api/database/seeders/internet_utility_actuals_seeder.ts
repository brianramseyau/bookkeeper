import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'

/**
 * The workbook's Rolling sheet (what import:xlsx sources Internet's actuals
 * from) only goes back to Feb 2026 - these Oct 2025-Jan 2026 actuals predate
 * that tracked window entirely, so there's no sheet cell for the importer to
 * ever read them from. Confirmed manually as a flat $114/month.
 */
const HISTORICAL_ACTUALS: { year: number; month: number; amount: number }[] = [
  { year: 2025, month: 10, amount: 114 },
  { year: 2025, month: 11, amount: 114 },
  { year: 2025, month: 12, amount: 114 },
  { year: 2026, month: 1, amount: 114 },
]

export default class extends BaseSeeder {
  async run() {
    const utilitiesCategory = await Category.findByOrFail('name', 'Utilities')
    const utility = await Utility.firstOrCreate(
      { name: 'Internet' },
      { name: 'Internet', categoryId: utilitiesCategory.id, frequency: 'monthly' }
    )

    for (const { year, month, amount } of HISTORICAL_ACTUALS) {
      await UtilityBill.updateOrCreate({ utilityId: utility.id, year, month }, { amount })
    }
  }
}
