import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Category from '#models/category'

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
  }
}
