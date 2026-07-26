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
      'customIntervalValue',
      'customIntervalUnit',
      'dueDay',
      'dueMonth',
      'dueYear',
      'nextDueOn',
      'isActive',
      'isPaused',
      'isArchived',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
