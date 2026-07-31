import vine from '@vinejs/vine'

export const createExpenseBudgetItemValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(80),
  amount: vine.number().min(0),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})

export const updateExpenseBudgetItemValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(80).optional(),
  amount: vine.number().min(0).optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})
