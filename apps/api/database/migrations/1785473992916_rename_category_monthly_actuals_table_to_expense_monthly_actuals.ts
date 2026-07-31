import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.renameTable('category_monthly_actuals', 'expense_monthly_actuals')
    this.schema.alterTable('expense_monthly_actuals', (table) => {
      table.renameColumn('category_id', 'expense_id')
    })
  }

  async down() {
    this.schema.alterTable('expense_monthly_actuals', (table) => {
      table.renameColumn('expense_id', 'category_id')
    })
    this.schema.renameTable('expense_monthly_actuals', 'category_monthly_actuals')
  }
}
