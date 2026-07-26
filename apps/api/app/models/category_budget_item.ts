import { CategoryBudgetItemSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Category from '#models/category'

export default class CategoryBudgetItem extends CategoryBudgetItemSchema {
  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>
}
