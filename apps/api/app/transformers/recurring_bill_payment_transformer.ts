import type RecurringBillPayment from '#models/recurring_bill_payment'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class RecurringBillPaymentTransformer extends BaseTransformer<RecurringBillPayment> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'recurringBillId',
      'year',
      'month',
      'paid',
      'createdAt',
      'updatedAt',
    ])
  }
}
