import type CategoryPayment from '#models/category_payment'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class CategoryPaymentTransformer extends BaseTransformer<CategoryPayment> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'categoryId',
      'year',
      'month',
      'paid',
      'createdAt',
      'updatedAt',
    ])
  }
}
