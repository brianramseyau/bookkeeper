import { UtilitySchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Category from '#models/category'
import UtilityBill from '#models/utility_bill'

export default class Utility extends UtilitySchema {
  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @hasMany(() => UtilityBill)
  declare bills: HasMany<typeof UtilityBill>
}
