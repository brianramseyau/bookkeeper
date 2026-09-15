import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'
import RecurringBillTransformer from '#transformers/recurring_bill_transformer'
import RecurringBillPaymentTransformer from '#transformers/recurring_bill_payment_transformer'
import {
  createRecurringBillValidator,
  updateRecurringBillValidator,
} from '#validators/recurring_bill'
import { upsertRecurringBillPaymentValidator } from '#validators/recurring_bill_payment'
import { RollingAverageService } from '#services/rolling_average_service'
import {
  compareByDaysUntilDue,
  nextUnpaidRecurringBillDueDate,
} from '#services/recurring_bill_due_date'

const DUE_SOON_WINDOW_DAYS = 30

/**
 * Builds a lookup for a set of bills' computed next-due info, shared by the
 * `show` and `upcoming` actions so a bill's next due date can't disagree
 * between the detail page and the list. The lookup is built once (not per
 * bill) since it needs every bill's paid periods up front.
 */
async function dueInfoFor(bills: RecurringBill[]) {
  const billIds = bills.map((bill) => bill.id)
  const paidPayments = billIds.length
    ? await RecurringBillPayment.query().whereIn('recurringBillId', billIds).where('paid', true)
    : []
  const paidPeriods = new Set(
    paidPayments.map((payment) => `${payment.recurringBillId}-${payment.year}-${payment.month}`)
  )
  const today = DateTime.local().startOf('day')

  return (bill: RecurringBill) => {
    const nextOccurrence = nextUnpaidRecurringBillDueDate(
      bill.frequency,
      bill.dueDay,
      bill.dueMonth,
      bill.dueYear,
      today,
      (year, month) => paidPeriods.has(`${bill.id}-${year}-${month}`)
    )
    const daysUntilDue = nextOccurrence ? Math.floor(nextOccurrence.diff(today, 'days').days) : null
    return {
      nextDueOn: nextOccurrence?.toISODate() ?? null,
      daysUntilDue,
      dueSoon: daysUntilDue !== null && daysUntilDue <= DUE_SOON_WINDOW_DAYS,
    }
  }
}

export default class RecurringBillsController {
  async index({ request, serialize }: HttpContext) {
    const query = RecurringBill.query().orderBy('name', 'asc')
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isPaused', false).andWhere('isArchived', false)
    }
    const bills = await query
    return serialize(RecurringBillTransformer.transform(bills))
  }

  async show({ params, serialize }: HttpContext) {
    const bill = await RecurringBill.findOrFail(params.id)
    const due = await dueInfoFor([bill])
    const data = await serialize.withoutWrapping(RecurringBillTransformer.transform(bill))
    return { data: { ...data, ...due(bill) } }
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createRecurringBillValidator)
    const nextDueOn = payload.nextDueOn

    const bill = await RecurringBill.create({
      name: payload.name,
      categoryId: payload.categoryId ?? null,
      amount: payload.amount,
      frequency: payload.frequency,
      dueDay: nextDueOn.day,
      dueMonth: nextDueOn.month,
      dueYear: nextDueOn.year,
      notes: payload.notes ?? null,
    })

    return response.created(await serialize(RecurringBillTransformer.transform(bill)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const bill = await RecurringBill.findOrFail(params.id)
    const payload = await request.validateUsing(updateRecurringBillValidator)

    bill.merge({
      name: payload.name,
      categoryId: payload.categoryId,
      amount: payload.amount,
      frequency: payload.frequency,
      isActive: payload.isActive,
      isPaused: payload.isArchived ? false : payload.isPaused,
      isArchived: payload.isArchived,
      notes: payload.notes,
    })

    if (payload.nextDueOn) {
      bill.dueDay = payload.nextDueOn.day
      bill.dueMonth = payload.nextDueOn.month
      bill.dueYear = payload.nextDueOn.year
    }

    await bill.save()
    return serialize(RecurringBillTransformer.transform(bill))
  }

  async destroy({ params, response }: HttpContext) {
    const bill = await RecurringBill.findOrFail(params.id)
    if (!bill.isArchived) {
      return response.conflict({ message: 'Only archived bills can be permanently removed' })
    }

    // Hard delete - the DB's CASCADE FK deletes recurring_bill_payments.
    await bill.delete()

    return response.noContent()
  }

  async payments({ params, serialize }: HttpContext) {
    const recurringBillId = Number(params.id)
    await RecurringBill.findOrFail(recurringBillId)

    const payments = await RecurringBillPayment.query()
      .where('recurringBillId', recurringBillId)
      .orderBy('year', 'desc')
      .orderBy('month', 'desc')

    return serialize(RecurringBillPaymentTransformer.transform(payments))
  }

  async destroyPayment({ params, response }: HttpContext) {
    const payment = await RecurringBillPayment.findOrFail(params.id)
    await payment.delete()
    return response.noContent()
  }

  async trend({ params, response }: HttpContext) {
    const recurringBillId = Number(params.id)
    const bill = await RecurringBill.findOrFail(recurringBillId)
    const payments = await RecurringBillPayment.query().where('recurringBillId', recurringBillId)

    const service = new RollingAverageService()
    return response.json(
      service.computeTrendWithFallback(
        payments.map((payment) => ({
          year: payment.year,
          month: payment.month,
          amount: payment.amount,
        })),
        bill.amount
      )
    )
  }

  async upsertPayment({ params, request, serialize }: HttpContext) {
    const recurringBillId = Number(params.id)
    await RecurringBill.findOrFail(recurringBillId)
    const payload = await request.validateUsing(upsertRecurringBillPaymentValidator)
    const year = Number(params.year)
    const month = Number(params.month)

    // Same distinguish-omitted-from-unset reasoning as UtilityBillsController.upsert -
    // the Paid checkbox and the amount-edit form each send only their own
    // field, and neither should stomp the other's already-saved value.
    let payment = await RecurringBillPayment.query().where({ recurringBillId, year, month }).first()
    if (payment) {
      payment.merge({
        ...(payload.paid !== undefined ? { paid: payload.paid } : {}),
        ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
      })
      await payment.save()
    } else {
      payment = await RecurringBillPayment.create({
        recurringBillId,
        year,
        month,
        paid: payload.paid ?? false,
        amount: payload.amount ?? null,
      })
    }

    return serialize(RecurringBillPaymentTransformer.transform(payment))
  }

  async upcoming({ request, serialize }: HttpContext) {
    const query = RecurringBill.query()
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isPaused', false).andWhere('isArchived', false)
    }
    const bills = await query

    // Shared with show (and the dashboard/notification scheduler via
    // nextUnpaidRecurringBillDueDate's own docs) so "next due" can't disagree
    // - marking the current occurrence paid here jumps straight to the next
    // unpaid one, rather than waiting for the due date to lapse.
    const due = await dueInfoFor(bills)
    const serialized = await serialize.withoutWrapping(RecurringBillTransformer.transform(bills))

    const results = serialized.map((item, index) => ({
      ...item,
      ...due(bills[index]!),
    }))

    // Sorted here (rather than in the query) because `daysUntilDue` is
    // computed, not a stored column.
    results.sort((a, b) => compareByDaysUntilDue(a.daysUntilDue, b.daysUntilDue))

    return { data: results }
  }
}
