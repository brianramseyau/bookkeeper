import type { HttpContext } from '@adonisjs/core/http'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import UtilityBillTransformer from '#transformers/utility_bill_transformer'
import { upsertUtilityBillValidator } from '#validators/utility_bill'
import { RollingAverageService } from '#services/rolling_average_service'

export default class UtilityBillsController {
  async index({ params, serialize }: HttpContext) {
    const utilityId = Number(params.utilityId)
    await Utility.findOrFail(utilityId)
    const bills = await UtilityBill.query()
      .where('utilityId', utilityId)
      .orderBy('year', 'asc')
      .orderBy('month', 'asc')
    return serialize(UtilityBillTransformer.transform(bills))
  }

  async upsert({ params, request, serialize }: HttpContext) {
    const utilityId = Number(params.utilityId)
    await Utility.findOrFail(utilityId)
    const payload = await request.validateUsing(upsertUtilityBillValidator)
    const year = Number(params.year)
    const month = Number(params.month)

    const bill = await UtilityBill.updateOrCreate(
      { utilityId, year, month },
      { amount: payload.amount, notes: payload.notes ?? null }
    )

    return serialize(UtilityBillTransformer.transform(bill))
  }

  async destroy({ params, response }: HttpContext) {
    const bill = await UtilityBill.findOrFail(params.id)
    await bill.delete()
    return response.noContent()
  }

  async trend({ params, response }: HttpContext) {
    const utilityId = Number(params.utilityId)
    await Utility.findOrFail(utilityId)
    const bills = await UtilityBill.query().where('utilityId', utilityId)

    const service = new RollingAverageService()
    const result = service.computeTrend(
      bills.map((bill) => ({ year: bill.year, month: bill.month, amount: bill.amount }))
    )

    return response.json(result)
  }
}
