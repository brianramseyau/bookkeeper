import vine from '@vinejs/vine'

export const upsertExpensePaymentValidator = vine.create({
  paid: vine.boolean(),
})
