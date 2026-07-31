import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Optional tag: an Expense can be bucketed under a Category for future
 * reporting, but never needs one to exist - that's the whole point of the
 * split (see AGENTS.md).
 *
 * `disableTransactions` + the `PRAGMA foreign_keys` bracketing are load-
 * bearing, not decoration - same issue as the repoint migrations above:
 * adding a column with an inline foreign key reference makes knex rebuild
 * the whole `expenses` table on SQLite (create new, copy rows, drop old,
 * rename), and with `foreign_keys = ON` that DROP cascade-deletes every
 * `expense_budget_items`/`expense_monthly_actuals`/`expense_payments` row
 * referencing it (`ON DELETE CASCADE`) as a side effect - confirmed by
 * reproducing it against a real data copy. `PRAGMA foreign_keys` only
 * takes effect outside an open transaction, hence `disableTransactions`.
 */
export default class extends BaseSchema {
  protected tableName = 'expenses'
  static disableTransactions = true

  async up() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('categories')
        .onDelete('SET NULL')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }

  async down() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('category_id')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }
}
