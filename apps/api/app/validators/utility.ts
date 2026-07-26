import vine from '@vinejs/vine'

const FREQUENCIES = ['monthly', 'quarterly', 'biannual', 'annual'] as const

export const createUtilityValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120),
  categoryId: vine.number().positive().optional(),
  frequency: vine.enum(FREQUENCIES).optional(),
  dueOffsetDays: vine.number().min(0).nullable().optional(),
})

export const updateUtilityValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120).optional(),
  categoryId: vine.number().positive().nullable().optional(),
  frequency: vine.enum(FREQUENCIES).optional(),
  dueOffsetDays: vine.number().min(0).nullable().optional(),
  isActive: vine.boolean().optional(),
})
