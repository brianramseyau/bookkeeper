import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * First step of the Category/Expense split (see AGENTS.md): the original
 * `categories` table actually owns real expense-tracking data (budget
 * amount, includeInStandardMonth, and the child tables renamed in the
 * migrations that follow this one) - it's renamed to `expenses` wholesale
 * so a brand-new, separately-numbered `categories` table can be introduced
 * as a pure tag (see `create_categories_table`). SQLite's native table
 * rename updates every other table's `REFERENCES categories(id)` clause
 * automatically.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.renameTable('categories', 'expenses')
  }

  async down() {
    this.schema.renameTable('expenses', 'categories')
  }
}
