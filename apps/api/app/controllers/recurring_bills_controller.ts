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

const DUE_SOON_WINDOW_DAYS = 30

export default class RecurringBillsController {
  async index({ request, serialize }: HttpContext) {
    const query = RecurringBill.query().orderBy('name', 'asc')
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isPaused', false).andWhere('isArchived', false)
    }
    const bills = await query
    return serialize(RecurringBillTransformer.transform(bills))
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createRecurringBillValidator)
    const nextDueOn = payload.nextDueOn

    const bill = await RecurringBill.create({
      name: payload.name,
      categoryId: payload.categoryId ?? null,
      amount: payload.amount,
      frequency: payload.frequency,
      customIntervalValue: payload.customIntervalValue ?? null,
      customIntervalUnit: payload.customIntervalUnit ?? null,
      dueDay: nextDueOn.day,
      dueMonth: nextDueOn.month,
      dueYear: nextDueOn.year,
      nextDueOn,
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
      customIntervalValue: payload.customIntervalValue,
      customIntervalUnit: payload.customIntervalUnit,
      isActive: payload.isActive,
      isPaused: payload.isArchived ? false : payload.isPaused,
      isArchived: payload.isArchived,
      notes: payload.notes,
    })

    if (payload.nextDueOn) {
      const nextDueOn = payload.nextDueOn
      bill.nextDueOn = nextDueOn
      bill.dueDay = nextDueOn.day
      bill.dueMonth = nextDueOn.month
      bill.dueYear = nextDueOn.year
    }

    await bill.save()
    return serialize(RecurringBillTransformer.transform(bill))
  }

  async destroy({ params, response }: HttpContext) {
    const bill = await RecurringBill.findOrFail(params.id)
    if (!bill.isArchived) {
      return response.conflict({ message: 'Only archived bills can be permanently removed' })
    }

    // Hard delete - SQLite FK enforcement is off in this app, so the
    // CASCADE declared in the migration doesn't fire on its own.
    await RecurringBillPayment.query().where('recurringBillId', bill.id).delete()
    await bill.delete()

    return response.noContent()
  }

  async upsertPayment({ params, request, serialize }: HttpContext) {
    const recurringBillId = Number(params.id)
    await RecurringBill.findOrFail(recurringBillId)
    const payload = await request.validateUsing(upsertRecurringBillPaymentValidator)
    const year = Number(params.year)
    const month = Number(params.month)

    const payment = await RecurringBillPayment.updateOrCreate(
      { recurringBillId, year, month },
      { paid: payload.paid }
    )

    return serialize(RecurringBillPaymentTransformer.transform(payment))
  }

  async upcoming({ request, serialize }: HttpContext) {
    const query = RecurringBill.query()
      .orderByRaw('next_due_on IS NULL')
      .orderBy('nextDueOn', 'asc')
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isPaused', false).andWhere('isArchived', false)
    }
    const bills = await query

    const today = DateTime.utc().startOf('day')
    const serialized = await serialize.withoutWrapping(RecurringBillTransformer.transform(bills))

    const results = serialized.map((item, index) => {
      const bill = bills[index]!
      const daysUntilDue = bill.nextDueOn
        ? Math.floor(bill.nextDueOn.diff(today, 'days').days)
        : null
      return {
        ...item,
        daysUntilDue,
        dueSoon: daysUntilDue !== null && daysUntilDue <= DUE_SOON_WINDOW_DAYS,
      }
    })

    return { data: results }
  }
}
