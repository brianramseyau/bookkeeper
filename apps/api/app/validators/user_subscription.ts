import vine from '@vinejs/vine'

export const createUserSubscriptionValidator = vine.create({
  userId: vine.number().positive(),
  name: vine.string().trim().minLength(1).maxLength(160),
  categoryId: vine.number().positive().nullable().optional(),
  amount: vine.number().min(0),
  dayOfMonth: vine.number().min(1).max(31).nullable().optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})

export const updateUserSubscriptionValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(160).optional(),
  categoryId: vine.number().positive().nullable().optional(),
  amount: vine.number().min(0).optional(),
  dayOfMonth: vine.number().min(1).max(31).nullable().optional(),
  includeInStandardMonth: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
  isPaused: vine.boolean().optional(),
  isArchived: vine.boolean().optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})
