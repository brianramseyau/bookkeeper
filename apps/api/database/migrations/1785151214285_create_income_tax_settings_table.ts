import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One row per (user, financial year) - the household's manually-entered
 * marginal tax rate, used to derive Tax/Gain on non-PAYG income
 * (dividends, share sales, bonuses) for that year. `financial_year` is the
 * *ending* year of the Jul-Jun Australian financial year (e.g. `2026` =
 * FY26 = Jul 2025-Jun 2026), matching the source workbook's own `Tax_FY26`
 * table naming.
 */
export default class extends BaseSchema {
  protected tableName = 'income_tax_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.integer('financial_year').notNullable()
      table.decimal('marginal_rate', 6, 4).notNullable()
      table.unique(['user_id', 'financial_year'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
