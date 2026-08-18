import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One-level nesting: a Category may reference another Category as its parent.
 * Children are full categories (can tag bills/subscriptions/expenses) and are
 * deleted with their parent (CASCADE). Deleting a parent is only possible via
 * the "permanently remove" flow, which already requires the parent to be
 * archived - and archiving a parent archives its children too (see
 * CategoriesController), so the tree can't be half-archived when removed.
 *
 * `disableTransactions` + the `PRAGMA foreign_keys` bracketing are load-
 * bearing, not decoration - see AGENTS.md "SQLite table-rebuild migrations":
 * adding a column with an inline foreign key reference makes knex rebuild the
 * whole `categories` table on SQLite (create new, copy rows, drop old, rename),
 * and with `foreign_keys = ON` that DROP cascade-deletes every
 * `expense_monthly_actuals`/`expense_budget_items`/`expense_payments` row
 * referencing a category (`ON DELETE CASCADE`) as a side effect.
 * `PRAGMA foreign_keys` only takes effect outside an open transaction, hence
 * `disableTransactions`.
 */
export default class extends BaseSchema {
  protected tableName = 'categories'
  static disableTransactions = true

  async up() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table
        .integer('parent_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('categories')
        .onDelete('CASCADE')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }

  async down() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('parent_id')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }
}
