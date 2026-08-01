import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `disableTransactions` + the `PRAGMA foreign_keys` bracketing are load-
 * bearing, not decoration - same issue as `alter_expenses_table_drop_color`
 * and the repoint migrations: SQLite can't drop a column in place, so
 * `dropColumn` rebuilds the whole `recurring_bills` table (create new, copy
 * rows, drop old, rename). With `foreign_keys = ON` (this app's default -
 * see config/database.ts), that DROP of the old `recurring_bills` table
 * cascade-deletes every `recurring_bill_payments` row referencing it
 * (`ON DELETE CASCADE`) as a side effect.
 */
export default class extends BaseSchema {
  protected tableName = 'recurring_bills'
  static disableTransactions = true

  async up() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('custom_interval_value')
      table.dropColumn('custom_interval_unit')
      table.dropColumn('due_year')
      table.dropColumn('next_due_on')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }

  async down() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.integer('custom_interval_value').unsigned().nullable()
      table.enum('custom_interval_unit', ['days', 'weeks', 'months']).nullable()
      table.integer('due_year').nullable()
      table.date('next_due_on').nullable()
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }
}
