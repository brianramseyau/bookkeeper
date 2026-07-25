import type { HttpContext } from '@adonisjs/core/http'
import IncomeSource from '#models/income_source'
import IncomeSourceTransformer from '#transformers/income_source_transformer'
import { createIncomeSourceValidator, updateIncomeSourceValidator } from '#validators/income_source'

export default class IncomeSourcesController {
  async index({ request, serialize }: HttpContext) {
    const userId = request.input('userId')
    const query = IncomeSource.query().orderBy('name', 'asc')
    if (userId) {
      query.where('userId', Number(userId))
    }
    const sources = await query
    return serialize(IncomeSourceTransformer.transform(sources))
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createIncomeSourceValidator)
    const source = await IncomeSource.create({
      userId: payload.userId,
      name: payload.name,
      expectedAmount: payload.expectedAmount,
      notes: payload.notes ?? null,
    })
    return response.created(await serialize(IncomeSourceTransformer.transform(source)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const source = await IncomeSource.findOrFail(params.id)
    const payload = await request.validateUsing(updateIncomeSourceValidator)
    source.merge(payload)
    await source.save()
    return serialize(IncomeSourceTransformer.transform(source))
  }

  async destroy({ params, response }: HttpContext) {
    const source = await IncomeSource.findOrFail(params.id)
    source.isActive = false
    await source.save()
    return response.noContent()
  }
}
