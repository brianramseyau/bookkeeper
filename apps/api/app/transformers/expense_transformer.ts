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
      'includeInStandardMonth',
      'categoryId',
      'isActive',
      'isPaused',
      'isArchived',
    ])
  }
}
