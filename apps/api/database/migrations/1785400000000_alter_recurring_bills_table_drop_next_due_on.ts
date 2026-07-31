import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'recurring_bills'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('custom_interval_value')
      table.dropColumn('custom_interval_unit')
      table.dropColumn('due_year')
      table.dropColumn('next_due_on')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('custom_interval_value').unsigned().nullable()
      table.enum('custom_interval_unit', ['days', 'weeks', 'months']).nullable()
      table.integer('due_year').nullable()
      table.date('next_due_on').nullable()
    })
  }
}
