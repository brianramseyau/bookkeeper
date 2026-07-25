import vine from '@vinejs/vine'

export const createIncomeSourceValidator = vine.create({
  userId: vine.number().positive(),
  name: vine.string().trim().minLength(1).maxLength(160),
  expectedAmount: vine.number().min(0),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})

export const updateIncomeSourceValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(160).optional(),
  expectedAmount: vine.number().min(0).optional(),
  isActive: vine.boolean().optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})
