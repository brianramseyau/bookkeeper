import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import CategoryMonthlyActualTransformer from '#transformers/category_monthly_actual_transformer'
import {
  createCategoryActualValidator,
  updateCategoryActualValidator,
} from '#validators/category_monthly_actual'
import { RollingAverageService } from '#services/rolling_average_service'

export default class CategoryActualsController {
  async index({ params, request, serialize }: HttpContext) {
    const categoryId = Number(params.id)
    await Category.findOrFail(categoryId)

    const year = request.input('year') ? Number(request.input('year')) : null
    const month = request.input('month') ? Number(request.input('month')) : null

    let actuals = await CategoryMonthlyActual.query()
      .where('categoryId', categoryId)
      .orderBy('occurredOn', 'asc')

    if (year !== null) {
      actuals = actuals.filter((a) => a.occurredOn.year === year)
    }
    if (month !== null) {
      actuals = actuals.filter((a) => a.occurredOn.month === month)
    }

    return serialize(CategoryMonthlyActualTransformer.transform(actuals))
  }

  async store({ params, request, response, serialize }: HttpContext) {
    const categoryId = Number(params.id)
    await Category.findOrFail(categoryId)
    const payload = await request.validateUsing(createCategoryActualValidator)

    const actual = await CategoryMonthlyActual.create({
      categoryId,
      occurredOn: payload.occurredOn,
      amount: payload.amount,
      notes: payload.notes ?? null,
    })

    return response.created(await serialize(CategoryMonthlyActualTransformer.transform(actual)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const actual = await CategoryMonthlyActual.findOrFail(params.id)
    const payload = await request.validateUsing(updateCategoryActualValidator)
    actual.merge(payload)
    await actual.save()
    return serialize(CategoryMonthlyActualTransformer.transform(actual))
  }

  async destroy({ params, response }: HttpContext) {
    const actual = await CategoryMonthlyActual.findOrFail(params.id)
    await actual.delete()
    return response.noContent()
  }

  async trend({ params, response }: HttpContext) {
    const categoryId = Number(params.id)
    await Category.findOrFail(categoryId)
    const actuals = await CategoryMonthlyActual.query().where('categoryId', categoryId)

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
