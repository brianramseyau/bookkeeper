import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `color` on `expenses` was a leftover from before Category/Expense were
 * split apart - Expense never displays a per-row color in the UI, only
 * Category does (see `categories` table's own `color` column). Dropping
 * the dead column rather than leaving it unused.
 *
 * `disableTransactions` + the `PRAGMA foreign_keys` bracketing are load-
 * bearing, not decoration - same issue as `alter_expenses_table_add_
 * category_id` and the repoint migrations: SQLite can't drop a column in
 * place, so `dropColumn` rebuilds the whole `expenses` table (create new,
 * copy rows, drop old, rename). With `foreign_keys = ON` (this app's
 * default - see config/database.ts), that DROP of the old `expenses` table
 * cascade-deletes every `expense_payments`/`expense_budget_items`/
 * `expense_monthly_actuals` row referencing it (`ON DELETE CASCADE`) as a
 * side effect - this is exactly what happened in production. `PRAGMA
 * foreign_keys` only takes effect outside an open transaction, hence
 * `disableTransactions`.
 */
export default class extends BaseSchema {
  protected tableName = 'expenses'
  static disableTransactions = true

  async up() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('color')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }

  async down() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.string('color', 32).nullable()
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }
}
