import vine from '@vinejs/vine'

export const createExpenseActualValidator = vine.create({
  occurredOn: vine.date(),
  amount: vine.number().min(0),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})

export const updateExpenseActualValidator = vine.create({
  occurredOn: vine.date().optional(),
  amount: vine.number().min(0).optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})
