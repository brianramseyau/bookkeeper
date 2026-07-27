import vine from '@vinejs/vine'

export const upsertCategoryPaymentValidator = vine.create({
  paid: vine.boolean(),
})
