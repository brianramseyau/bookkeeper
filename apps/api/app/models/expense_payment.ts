import { ExpensePaymentSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Expense from '#models/expense'

export default class ExpensePayment extends ExpensePaymentSchema {
  @belongsTo(() => Expense)
  declare expense: BelongsTo<typeof Expense>
}
