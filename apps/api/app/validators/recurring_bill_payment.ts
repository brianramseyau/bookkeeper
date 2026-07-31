import vine from '@vinejs/vine'

export const upsertRecurringBillPaymentValidator = vine.create({
  paid: vine.boolean().optional(),
  amount: vine.number().min(0).optional(),
})
