import vine from '@vinejs/vine'

const FREQUENCIES = ['monthly', 'quarterly', 'biannual', 'annual'] as const

export const createUtilityValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120),
  frequency: vine.enum(FREQUENCIES).optional(),
  dueOffsetDays: vine.number().min(0).nullable().optional(),
  dueOffsetBusinessDaysOnly: vine.boolean().optional(),
  paidInAdvance: vine.boolean().optional(),
})

export const updateUtilityValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120).optional(),
  frequency: vine.enum(FREQUENCIES).optional(),
  dueOffsetDays: vine.number().min(0).nullable().optional(),
  dueOffsetBusinessDaysOnly: vine.boolean().optional(),
  paidInAdvance: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
})
