import { ExpenseSchema } from '#database/schema'
import { beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Category, { colorForSortOrder } from '#models/category'
import ExpenseBudgetItem from '#models/expense_budget_item'

export default class Expense extends ExpenseSchema {
  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @hasMany(() => ExpenseBudgetItem)
  declare budgetItems: HasMany<typeof ExpenseBudgetItem>

  /**
   * Expenses are created from several places (the UI's "add expense" form,
   * findOrCreate calls during xlsx import) that don't specify a sortOrder -
   * without this they'd all silently default to the column's DB default of
   * 0, making every expense tie and the reorder UI a no-op.
   */
  @beforeCreate()
  static async assignSortOrder(expense: Expense) {
    if (expense.$attributes.sortOrder !== undefined) return
    // Must reuse the enclosing transaction's client if there is one - on
    // SQLite's single-connection pool, querying outside it while that
    // transaction holds the only connection deadlocks instead of erroring.
    const query = expense.$trx ? Expense.query({ client: expense.$trx }) : Expense.query()
    const last = await query.orderBy('sortOrder', 'desc').first()
    expense.sortOrder = last ? last.sortOrder + 1 : 0
  }

  /**
   * Expenses are also created without a color (the same findOrCreate calls
   * during xlsx import) - assign one from Category's fixed palette rather
   * than leaving every expense the same washed-out default gray. Runs
   * after assignSortOrder above so it can key off the sortOrder just
   * assigned.
   */
  @beforeCreate()
  static async assignColor(expense: Expense) {
    if (expense.$attributes.color !== undefined) return
    expense.color = colorForSortOrder(expense.sortOrder)
  }
}
