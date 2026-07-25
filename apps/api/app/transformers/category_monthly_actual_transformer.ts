import type CategoryMonthlyActual from '#models/category_monthly_actual'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class CategoryMonthlyActualTransformer extends BaseTransformer<CategoryMonthlyActual> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'categoryId',
      'occurredOn',
      'amount',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
