import { RecurringBillPaymentSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import RecurringBill from '#models/recurring_bill'

export default class RecurringBillPayment extends RecurringBillPaymentSchema {
  @belongsTo(() => RecurringBill)
  declare recurringBill: BelongsTo<typeof RecurringBill>
}
