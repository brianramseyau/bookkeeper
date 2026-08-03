import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscription_payments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Null means "use the subscription's configured amount" - only set
      // once a month's actual charge is explicitly entered/edited, same
      // relationship recurring_bill_payments.amount has to a recurring
      // bill's own amount column. Without this, a price increase silently
      // rewrites every past month's actual to the new amount, since the
      // standard month projection had nothing but the live amount to show.
      table.decimal('amount', 10, 2).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('amount')
    })
  }
}
