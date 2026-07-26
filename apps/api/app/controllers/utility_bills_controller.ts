import type { HttpContext } from '@adonisjs/core/http'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import UtilityBillTransformer from '#transformers/utility_bill_transformer'
import { upsertUtilityBillValidator } from '#validators/utility_bill'
import { RollingAverageService } from '#services/rolling_average_service'
import {
  expandUtilityBillsToMonthlyShares,
  utilityPeriodMonths,
} from '#services/utility_billing_period'

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export default class UtilityBillsController {
  async index({ params, serialize, response }: HttpContext) {
    const utilityId = Number(params.utilityId)
    const utility = await Utility.findOrFail(utilityId)
    const bills = await UtilityBill.query()
      .where('utilityId', utilityId)
      .orderBy('year', 'asc')
      .orderBy('month', 'asc')

    // Every covered month of a non-monthly bill's period (including the
    // billing month itself) so the frontend can show one consistent
    // per-month figure across the whole period rather than the full total
    // looking like an outlier next to its own split shares. Skipped
    // entirely for monthly utilities, where a bill already is its own share.
    const monthlyShares =
      utilityPeriodMonths(utility.frequency) <= 1
        ? []
        : expandUtilityBillsToMonthlyShares(bills, utility.frequency).map((share) => ({
            year: share.year,
            month: share.month,
            amount: round(share.amount),
            billYear: share.billYear,
            billMonth: share.billMonth,
          }))

    return response.json({
      bills: await serialize.withoutWrapping(UtilityBillTransformer.transform(bills)),
      monthlyShares,
    })
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
    const utility = await Utility.findOrFail(utilityId)
    const bills = await UtilityBill.query().where('utilityId', utilityId)

    const service = new RollingAverageService()
    const result = service.computeTrend(expandUtilityBillsToMonthlyShares(bills, utility.frequency))

    return response.json(result)
  }
}
