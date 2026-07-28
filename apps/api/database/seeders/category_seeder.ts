import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category, { colorForSortOrder } from '#models/category'

const DEFAULT_CATEGORIES = [
  'Groceries',
  'Household',
  'Utilities',
  'Subscriptions',
  'Fees',
  'Transport',
  'Clothing',
  'Childcare',
]

export default class extends BaseSeeder {
  async run() {
    await Category.updateOrCreateMany(
      'name',
      DEFAULT_CATEGORIES.map((name, index) => ({ name, sortOrder: index }))
    )

    // Backfills color on categories that predate the palette (the defaults
    // above, plus ones the xlsx importer created on demand before this
    // existed) - only touches rows with no color set, so a color chosen
    // manually via the app's settings page is never overwritten, same as
    // user_seeder's displayColor handling.
    const uncolored = await Category.query().whereNull('color')
    for (const category of uncolored) {
      category.color = colorForSortOrder(category.sortOrder)
      await category.save()
    }
  }
}
