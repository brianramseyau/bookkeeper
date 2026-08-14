import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import UtilityBillTransformer from '#transformers/utility_bill_transformer'
import { upsertUtilityBillValidator } from '#validators/utility_bill'
import { RollingAverageService } from '#services/rolling_average_service'
import {
  expandUtilityBillsToMonthlyShares,
  mostRecentUtilityBill,
  nextUtilityDueDate,
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
        : expandUtilityBillsToMonthlyShares(bills, utility.frequency, utility.paidInAdvance).map(
            (share) => ({
              year: share.year,
              month: share.month,
              amount: round(share.amount),
              billYear: share.billYear,
              billMonth: share.billMonth,
            })
          )

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

    // A plain `updateOrCreate` payload can't distinguish "the client didn't
    // send paid, leave it as-is" from "the client wants it unset" - and on
    // the create path, a paid the client never sent must still resolve to
    // an explicit `false` in memory (the DB column default isn't read back
    // onto the in-memory instance), not stay `undefined`. Branching finds
    // both needs without stomping an existing value on unrelated updates.
    let bill = await UtilityBill.query().where({ utilityId, year, month }).first()
    if (bill) {
      bill.merge({
        amount: payload.amount,
        notes: payload.notes ?? null,
        ...(payload.paid !== undefined ? { paid: payload.paid } : {}),
        ...(payload.receivedOn !== undefined ? { receivedOn: payload.receivedOn } : {}),
      })
      await bill.save()
    } else {
      bill = await UtilityBill.create({
        utilityId,
        year,
        month,
        amount: payload.amount,
        notes: payload.notes ?? null,
        paid: payload.paid ?? false,
        receivedOn: payload.receivedOn ?? null,
      })
    }

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
    const result = service.computeTrend(
      expandUtilityBillsToMonthlyShares(bills, utility.frequency, utility.paidInAdvance)
    )
    const nextDueOn = nextUtilityDueDate(utility, bills, DateTime.local().startOf('day'))

    // The rolling-average window is built from amortized monthly shares (a
    // quarterly/annual bill split evenly across the months it covers) so the
    // average, trend indicator and chart read as a plain monthly series -
    // see `expandUtilityBillsToMonthlyShares`. But "Latest bill" is meant to
    // show what the last bill actually cost and when it was issued, not that
    // bill's per-month share, so it's sourced from the real bill record
    // instead of the shares window.
    const latestBill = mostRecentUtilityBill(bills)

    return response.json({
      ...result,
      ...(latestBill
        ? {
            latestAmount: round(latestBill.amount),
            latestYear: latestBill.year,
            latestMonth: latestBill.month,
          }
        : {}),
      nextDueOn: nextDueOn?.toISO() ?? null,
    })
  }
}
