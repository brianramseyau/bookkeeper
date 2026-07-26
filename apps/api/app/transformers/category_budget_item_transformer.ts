import type CategoryBudgetItem from '#models/category_budget_item'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class CategoryBudgetItemTransformer extends BaseTransformer<CategoryBudgetItem> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'categoryId',
      'name',
      'amount',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
