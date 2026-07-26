import { IncomeSourceSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export type IncomeSourceFrequency = 'monthly' | 'fortnightly'

export default class IncomeSource extends IncomeSourceSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
