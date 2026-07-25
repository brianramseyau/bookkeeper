import type { HttpContext } from '@adonisjs/core/http'
import IncomeEntry from '#models/income_entry'
import IncomeEntryTransformer from '#transformers/income_entry_transformer'
import { createIncomeEntryValidator, updateIncomeEntryValidator } from '#validators/income_entry'

export default class IncomeEntriesController {
  async index({ request, serialize }: HttpContext) {
    const year = request.input('year')
    const month = request.input('month')
    const userId = request.input('userId')

    const query = IncomeEntry.query().orderBy('year', 'asc').orderBy('month', 'asc')
    if (year) query.where('year', Number(year))
    if (month) query.where('month', Number(month))
    if (userId) query.where('userId', Number(userId))

    const entries = await query
    return serialize(IncomeEntryTransformer.transform(entries))
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createIncomeEntryValidator)
    const entry = await IncomeEntry.create({
      incomeSourceId: payload.incomeSourceId ?? null,
      userId: payload.userId ?? null,
      year: payload.year,
      month: payload.month,
      receivedOn: payload.receivedOn ?? null,
      amount: payload.amount,
      note: payload.note ?? null,
    })
    return response.created(await serialize(IncomeEntryTransformer.transform(entry)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const entry = await IncomeEntry.findOrFail(params.id)
    const payload = await request.validateUsing(updateIncomeEntryValidator)
    entry.merge(payload)
    await entry.save()
    return serialize(IncomeEntryTransformer.transform(entry))
  }

  async destroy({ params, response }: HttpContext) {
    const entry = await IncomeEntry.findOrFail(params.id)
    await entry.delete()
    return response.noContent()
  }
}
