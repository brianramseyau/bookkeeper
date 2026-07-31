import type { HttpContext } from '@adonisjs/core/http'
import Expense from '#models/expense'
import ExpenseBudgetItem from '#models/expense_budget_item'
import ExpenseBudgetItemTransformer from '#transformers/expense_budget_item_transformer'
import {
  createExpenseBudgetItemValidator,
  updateExpenseBudgetItemValidator,
} from '#validators/expense_budget_item'

export default class ExpenseBudgetItemsController {
  async index({ params, serialize }: HttpContext) {
    const expenseId = Number(params.id)
    await Expense.findOrFail(expenseId)

    const items = await ExpenseBudgetItem.query()
      .where('expenseId', expenseId)
      .orderBy('name', 'asc')

    return serialize(ExpenseBudgetItemTransformer.transform(items))
  }

  async store({ params, request, response, serialize }: HttpContext) {
    const expenseId = Number(params.id)
    await Expense.findOrFail(expenseId)
    const payload = await request.validateUsing(createExpenseBudgetItemValidator)

    const item = await ExpenseBudgetItem.create({
      expenseId,
      name: payload.name,
      amount: payload.amount,
      notes: payload.notes ?? null,
    })
    await this.syncExpenseBudget(expenseId)

    return response.created(await serialize(ExpenseBudgetItemTransformer.transform(item)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const item = await ExpenseBudgetItem.findOrFail(params.id)
    const payload = await request.validateUsing(updateExpenseBudgetItemValidator)
    item.merge(payload)
    await item.save()
    await this.syncExpenseBudget(item.expenseId)

    return serialize(ExpenseBudgetItemTransformer.transform(item))
  }

  async destroy({ params, response }: HttpContext) {
    const item = await ExpenseBudgetItem.findOrFail(params.id)
    const expenseId = item.expenseId
    await item.delete()
    await this.syncExpenseBudget(expenseId)

    return response.noContent()
  }

  /**
   * Once an expense has any itemized budget lines, its budgetAmount is a
   * derived total rather than a free-standing manual figure - keep it in
   * sync with the items, and clear it back to null (fall back to the
   * rolling average) if the last item is removed.
   */
  private async syncExpenseBudget(expenseId: number) {
    const items = await ExpenseBudgetItem.query().where('expenseId', expenseId)
    const expense = await Expense.findOrFail(expenseId)
    expense.budgetAmount =
      items.length > 0
        ? Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100
        : null
    await expense.save()
  }
}
