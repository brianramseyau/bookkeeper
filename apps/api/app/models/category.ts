import { CategorySchema } from '#database/schema'
import { beforeCreate, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import CategoryBudgetItem from '#models/category_budget_item'

/**
 * Fixed palette a new category's color is picked from when none is given -
 * ordered (not just hue-sorted) so that categories created back-to-back land
 * on colors as visually distinct from their immediate neighbors as 16 slots
 * allow (validated with the dataviz skill's CVD/contrast checks against
 * adjacent pairs; full pairwise separation across all 16 isn't achievable at
 * this count - see the skill's own categorical-palette notes).
 */
export const CATEGORY_COLOR_PALETTE = [
  '#e3769b',
  '#a92800',
  '#72b258',
  '#007a66',
  '#8696f5',
  '#882e9b',
  '#e18343',
  '#7a5900',
  '#00b9b2',
  '#0066b2',
  '#cc7dcb',
  '#ab1541',
  '#aca220',
  '#007717',
  '#3fa7ee',
  '#5d43bb',
] as const

export function colorForSortOrder(sortOrder: number): string {
  return CATEGORY_COLOR_PALETTE[sortOrder % CATEGORY_COLOR_PALETTE.length]!
}

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

  /**
   * Categories are also created without a color (the same findOrCreate calls
   * during xlsx import, category_seeder's defaults) - assign one from the
   * fixed palette rather than leaving every category the same washed-out
   * default gray. Runs after assignSortOrder above so it can key off the
   * sortOrder just assigned.
   */
  @beforeCreate()
  static async assignColor(category: Category) {
    if (category.$attributes.color !== undefined) return
    category.color = colorForSortOrder(category.sortOrder)
  }
}
