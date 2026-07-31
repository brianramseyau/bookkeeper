import { ExpenseBudgetItemSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Expense from '#models/expense'

export default class ExpenseBudgetItem extends ExpenseBudgetItemSchema {
  @belongsTo(() => Expense)
  declare expense: BelongsTo<typeof Expense>
}
