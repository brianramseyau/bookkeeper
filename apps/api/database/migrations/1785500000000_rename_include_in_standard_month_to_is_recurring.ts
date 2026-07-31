import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('expenses', (table) => {
      table.renameColumn('include_in_standard_month', 'is_recurring')
    })
    this.schema.alterTable('user_subscriptions', (table) => {
      table.renameColumn('include_in_standard_month', 'is_recurring')
    })
  }

  async down() {
    this.schema.alterTable('user_subscriptions', (table) => {
      table.renameColumn('is_recurring', 'include_in_standard_month')
    })
    this.schema.alterTable('expenses', (table) => {
      table.renameColumn('is_recurring', 'include_in_standard_month')
    })
  }
}
