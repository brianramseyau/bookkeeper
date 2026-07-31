import type Expense from '#models/expense'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ExpenseTransformer extends BaseTransformer<Expense> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'name',
      'color',
      'sortOrder',
      'budgetAmount',
      'isRecurring',
      'excludeFromBudget',
      'categoryId',
      'isActive',
      'isPaused',
      'isArchived',
    ])
  }
}
