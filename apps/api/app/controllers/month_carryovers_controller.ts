import type { HttpContext } from '@adonisjs/core/http'
import MonthCarryover from '#models/month_carryover'
import MonthCarryoverTransformer from '#transformers/month_carryover_transformer'
import { upsertMonthCarryoverValidator } from '#validators/month_carryover'

export default class MonthCarryoversController {
  async show({ params, response, serialize }: HttpContext) {
    const year = Number(params.year)
    const month = Number(params.month)
    const carryover = await MonthCarryover.query().where('year', year).where('month', month).first()
    if (!carryover) {
      return response.json(null)
    }
    return serialize(MonthCarryoverTransformer.transform(carryover))
  }

  async upsert({ params, request, serialize }: HttpContext) {
    const year = Number(params.year)
    const month = Number(params.month)
    const payload = await request.validateUsing(upsertMonthCarryoverValidator)

    const carryover = await MonthCarryover.updateOrCreate(
      { year, month },
      { amount: payload.amount, notes: payload.notes ?? null }
    )

    return serialize(MonthCarryoverTransformer.transform(carryover))
  }
}
