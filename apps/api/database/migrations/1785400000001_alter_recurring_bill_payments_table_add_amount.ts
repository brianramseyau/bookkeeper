import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'recurring_bill_payments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Null means "use the bill's configured amount" - only set once an
      // occurrence's actual amount is explicitly entered/edited, the same
      // relationship utility_bills has between its own amount column and a
      // utility's trend-based projection.
      table.decimal('amount', 10, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('amount')
    })
  }
}
