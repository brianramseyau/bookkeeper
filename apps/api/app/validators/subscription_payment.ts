import vine from '@vinejs/vine'

export const upsertSubscriptionPaymentValidator = vine.create({
  paid: vine.boolean(),
})
