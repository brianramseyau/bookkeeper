import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.renameTable('category_payments', 'expense_payments')
    this.schema.alterTable('expense_payments', (table) => {
      table.renameColumn('category_id', 'expense_id')
    })
  }

  async down() {
    this.schema.alterTable('expense_payments', (table) => {
      table.renameColumn('expense_id', 'category_id')
    })
    this.schema.renameTable('expense_payments', 'category_payments')
  }
}
