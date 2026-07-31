import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.renameTable('category_budget_items', 'expense_budget_items')
    this.schema.alterTable('expense_budget_items', (table) => {
      table.renameColumn('category_id', 'expense_id')
    })
  }

  async down() {
    this.schema.alterTable('expense_budget_items', (table) => {
      table.renameColumn('expense_id', 'category_id')
    })
    this.schema.renameTable('expense_budget_items', 'category_budget_items')
  }
}
