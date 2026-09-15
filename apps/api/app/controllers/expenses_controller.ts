import type { HttpContext } from '@adonisjs/core/http'
import Expense from '#models/expense'
import ExpenseBudgetItem from '#models/expense_budget_item'
import ExpensePayment from '#models/expense_payment'
import ExpenseTransformer from '#transformers/expense_transformer'
import ExpensePaymentTransformer from '#transformers/expense_payment_transformer'
import { createExpenseValidator, updateExpenseValidator } from '#validators/expense'
import { upsertExpensePaymentValidator } from '#validators/expense_payment'

export default class ExpensesController {
  async index({ request, serialize }: HttpContext) {
    const query = Expense.query().orderBy('sortOrder', 'asc')
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isPaused', false).andWhere('isArchived', false)
    }
    const expenses = await query

    const items = await ExpenseBudgetItem.query().whereIn(
      'expenseId',
      expenses.map((expense) => expense.id)
    )
    const budgetItemCounts = new Map<number, number>()
    for (const item of items) {
      budgetItemCounts.set(item.expenseId, (budgetItemCounts.get(item.expenseId) ?? 0) + 1)
    }

    const serialized = await serialize.withoutWrapping(ExpenseTransformer.transform(expenses))
    const results = serialized.map((item, index) => ({
      ...item,
      budgetItemCount: budgetItemCounts.get(expenses[index]!.id) ?? 0,
    }))

    return { data: results }
  }

  async show({ params, serialize }: HttpContext) {
    const expense = await Expense.findOrFail(params.id)
    const budgetItems = await ExpenseBudgetItem.query().where('expenseId', expense.id)
    const data = await serialize.withoutWrapping(ExpenseTransformer.transform(expense))
    return { data: { ...data, budgetItemCount: budgetItems.length } }
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createExpenseValidator)
    const expense = await Expense.create(payload)
    return response.created(await serialize(ExpenseTransformer.transform(expense)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const expense = await Expense.findOrFail(params.id)
    const payload = await request.validateUsing(updateExpenseValidator)
    if (payload.isArchived) payload.isPaused = false
    expense.merge(payload)
    await expense.save()
    return serialize(ExpenseTransformer.transform(expense))
  }

  async destroy({ params, response }: HttpContext) {
    const expense = await Expense.findOrFail(params.id)
    if (!expense.isArchived) {
      return response.conflict({ message: 'Only archived expenses can be permanently removed' })
    }

    // Hard delete - the DB's CASCADE FKs handle dependents (expense_budget_items,
    // expense_payments, expense_monthly_actuals are deleted).
    await expense.delete()

    return response.noContent()
  }

  async upsertPayment({ params, request, serialize }: HttpContext) {
    const expenseId = Number(params.id)
    await Expense.findOrFail(expenseId)
    const payload = await request.validateUsing(upsertExpensePaymentValidator)
    const year = Number(params.year)
    const month = Number(params.month)

    const payment = await ExpensePayment.updateOrCreate(
      { expenseId, year, month },
      { paid: payload.paid }
    )

    return serialize(ExpensePaymentTransformer.transform(payment))
  }
}
