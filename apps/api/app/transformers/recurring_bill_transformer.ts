import type RecurringBill from '#models/recurring_bill'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class RecurringBillTransformer extends BaseTransformer<RecurringBill> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'name',
      'categoryId',
      'amount',
      'frequency',
      'dueDay',
      'dueMonth',
      'dueYear',
      'isActive',
      'isPaused',
      'isArchived',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
