import type ExpenseMonthlyActual from '#models/expense_monthly_actual'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class ExpenseMonthlyActualTransformer extends BaseTransformer<ExpenseMonthlyActual> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'expenseId',
      'occurredOn',
      'amount',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
