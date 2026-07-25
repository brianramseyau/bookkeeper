import vine from '@vinejs/vine'

export const createCategoryValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(80),
  color: vine.string().trim().maxLength(20).nullable().optional(),
  sortOrder: vine.number().optional(),
  budgetAmount: vine.number().min(0).nullable().optional(),
  includeInStandardMonth: vine.boolean().optional(),
})

export const updateCategoryValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(80).optional(),
  color: vine.string().trim().maxLength(20).nullable().optional(),
  sortOrder: vine.number().optional(),
  budgetAmount: vine.number().min(0).nullable().optional(),
  includeInStandardMonth: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
})
