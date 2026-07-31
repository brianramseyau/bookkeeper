import type ExpensePayment from '#models/expense_payment'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ExpensePaymentTransformer extends BaseTransformer<ExpensePayment> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'expenseId',
      'year',
      'month',
      'paid',
      'createdAt',
      'updatedAt',
    ])
  }
}
