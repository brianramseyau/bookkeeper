import { CategorySchema } from '#database/schema'
import { beforeCreate, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import CategoryBudgetItem from '#models/category_budget_item'

export default class Category extends CategorySchema {
  @hasMany(() => CategoryBudgetItem)
  declare budgetItems: HasMany<typeof CategoryBudgetItem>

  /**
   * Categories are created from several places (the UI's "add category"
   * form, findOrCreate calls during xlsx import) that don't specify a
   * sortOrder - without this they'd all silently default to the column's
   * DB default of 0, making every category tie and the reorder UI a no-op.
   */
  @beforeCreate()
  static async assignSortOrder(category: Category) {
    if (category.$attributes.sortOrder !== undefined) return
    const last = await Category.query().orderBy('sortOrder', 'desc').first()
    category.sortOrder = last ? last.sortOrder + 1 : 0
  }
}
