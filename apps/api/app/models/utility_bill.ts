import { UtilityBillSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Utility from '#models/utility'

export default class UtilityBill extends UtilityBillSchema {
  @belongsTo(() => Utility)
  declare utility: BelongsTo<typeof Utility>
}
