import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { StandardMonthService } from '#services/standard_month_service'

export default class StandardMonthsController {
  async show({ request, response }: HttpContext) {
    const today = DateTime.local()
    const year = request.input('year') ? Number(request.input('year')) : today.year
    const month = request.input('month') ? Number(request.input('month')) : today.month

    const service = new StandardMonthService()
    const result = await service.compute(year, month)

    return response.json(result)
  }
}
