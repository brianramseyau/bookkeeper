import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `color` on `expenses` was a leftover from before Category/Expense were
 * split apart - Expense never displays a per-row color in the UI, only
 * Category does (see `categories` table's own `color` column). Dropping
 * the dead column rather than leaving it unused.
 */
export default class extends BaseSchema {
  protected tableName = 'expenses'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('color')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('color', 32).nullable()
    })
  }
}
