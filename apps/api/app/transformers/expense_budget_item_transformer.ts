import type ExpenseBudgetItem from '#models/expense_budget_item'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ExpenseBudgetItemTransformer extends BaseTransformer<ExpenseBudgetItem> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'expenseId',
      'name',
      'amount',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
