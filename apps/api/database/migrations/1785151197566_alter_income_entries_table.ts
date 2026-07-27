import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `tax_withheld` records whether PAYG withholding applied to an
 * unattributed entry (one with no `income_source_id`) - a source-tied
 * entry's tax treatment is already governed by that source's own
 * `tax_withheld` flag, so this column is left null for those rows and only
 * meaningful for standalone income (dividends, share sales, bonuses).
 */
export default class extends BaseSchema {
  protected tableName = 'income_entries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('tax_withheld').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('tax_withheld')
    })
  }
}
