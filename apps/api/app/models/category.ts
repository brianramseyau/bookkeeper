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
    // Must reuse the enclosing transaction's client if there is one - on
    // SQLite's single-connection pool, querying outside it while that
    // transaction holds the only connection deadlocks instead of erroring.
    const query = category.$trx ? Category.query({ client: category.$trx }) : Category.query()
    const last = await query.orderBy('sortOrder', 'desc').first()
    category.sortOrder = last ? last.sortOrder + 1 : 0
  }
}
