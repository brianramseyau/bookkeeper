import { IncomeEntrySchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import IncomeSource from '#models/income_source'

export default class IncomeEntry extends IncomeEntrySchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => IncomeSource)
  declare incomeSource: BelongsTo<typeof IncomeSource>
}
