import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Income sources gain real pay-cadence modeling instead of an implicit
 * "one lump sum per calendar month": a fixed monthly pay day (with an
 * optional weekend-rollback rule), or a fortnightly cycle anchored on a
 * real confirmed payday - the latter is what correctly produces 3 pay
 * periods in a month a couple of times a year instead of always assuming 2.
 * `tax_withheld` records whether PAYG withholding already applies to a
 * source, feeding the still-deferred non-PAYG income tax work.
 */
export default class extends BaseSchema {
  protected tableName = 'income_sources'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('frequency', ['monthly', 'fortnightly']).notNullable().defaultTo('monthly')
      table.integer('pay_day_of_month').nullable()
      table.boolean('weekend_rollback').notNullable().defaultTo(false)
      table.date('anchor_date').nullable()
      table.boolean('tax_withheld').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('frequency')
      table.dropColumn('pay_day_of_month')
      table.dropColumn('weekend_rollback')
      table.dropColumn('anchor_date')
      table.dropColumn('tax_withheld')
    })
  }
}
