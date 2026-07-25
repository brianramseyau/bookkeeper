import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'categories'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('budget_amount', 10, 2).nullable()
      table.boolean('include_in_standard_month').notNullable().defaultTo(true)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('budget_amount')
      table.dropColumn('include_in_standard_month')
    })
  }
}
