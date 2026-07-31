import type { HttpContext } from '@adonisjs/core/http'
import Expense from '#models/expense'
import ExpenseMonthlyActual from '#models/expense_monthly_actual'
import ExpenseMonthlyActualTransformer from '#transformers/expense_monthly_actual_transformer'
import {
  createExpenseActualValidator,
  updateExpenseActualValidator,
} from '#validators/expense_monthly_actual'
import { RollingAverageService } from '#services/rolling_average_service'

export default class ExpenseActualsController {
  async index({ params, request, serialize }: HttpContext) {
    const expenseId = Number(params.id)
    await Expense.findOrFail(expenseId)

    const year = request.input('year') ? Number(request.input('year')) : null
    const month = request.input('month') ? Number(request.input('month')) : null

    let actuals = await ExpenseMonthlyActual.query()
      .where('expenseId', expenseId)
      .orderBy('occurredOn', 'asc')

    if (year !== null) {
      actuals = actuals.filter((a) => a.occurredOn.year === year)
    }
    if (month !== null) {
      actuals = actuals.filter((a) => a.occurredOn.month === month)
    }

    return serialize(ExpenseMonthlyActualTransformer.transform(actuals))
  }

  async store({ params, request, response, serialize }: HttpContext) {
    const expenseId = Number(params.id)
    await Expense.findOrFail(expenseId)
    const payload = await request.validateUsing(createExpenseActualValidator)

    const actual = await ExpenseMonthlyActual.create({
      expenseId,
      occurredOn: payload.occurredOn,
      amount: payload.amount,
      notes: payload.notes ?? null,
    })

    return response.created(await serialize(ExpenseMonthlyActualTransformer.transform(actual)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const actual = await ExpenseMonthlyActual.findOrFail(params.id)
    const payload = await request.validateUsing(updateExpenseActualValidator)
    actual.merge(payload)
    await actual.save()
    return serialize(ExpenseMonthlyActualTransformer.transform(actual))
  }

  async destroy({ params, response }: HttpContext) {
    const actual = await ExpenseMonthlyActual.findOrFail(params.id)
    await actual.delete()
    return response.noContent()
  }

  async trend({ params, response }: HttpContext) {
    const expenseId = Number(params.id)
    await Expense.findOrFail(expenseId)
    const actuals = await ExpenseMonthlyActual.query().where('expenseId', expenseId)

    const service = new RollingAverageService()
    const result = service.computeTrend(
      actuals.map((actual) => ({
        year: actual.occurredOn.year,
        month: actual.occurredOn.month,
        amount: actual.amount,
      }))
    )

    return response.json(result)
  }
}
