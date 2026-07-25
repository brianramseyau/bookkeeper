import vine from '@vinejs/vine'

export const createUtilityValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120),
  categoryId: vine.number().positive().optional(),
})

export const updateUtilityValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(120).optional(),
  categoryId: vine.number().positive().nullable().optional(),
  isActive: vine.boolean().optional(),
})
