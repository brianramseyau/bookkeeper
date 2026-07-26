import vine from '@vinejs/vine'

export const upsertRecurringBillPaymentValidator = vine.create({
  paid: vine.boolean(),
})
