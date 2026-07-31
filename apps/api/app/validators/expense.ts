import vine from '@vinejs/vine'

export const createExpenseValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(80),
  color: vine.string().trim().maxLength(20).nullable().optional(),
  sortOrder: vine.number().optional(),
  budgetAmount: vine.number().min(0).nullable().optional(),
  isRecurring: vine.boolean().optional(),
  excludeFromBudget: vine.boolean().optional(),
  categoryId: vine.number().positive().nullable().optional(),
})

export const updateExpenseValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(80).optional(),
  color: vine.string().trim().maxLength(20).nullable().optional(),
  sortOrder: vine.number().optional(),
  budgetAmount: vine.number().min(0).nullable().optional(),
  isRecurring: vine.boolean().optional(),
  excludeFromBudget: vine.boolean().optional(),
  categoryId: vine.number().positive().nullable().optional(),
  isActive: vine.boolean().optional(),
  isPaused: vine.boolean().optional(),
  isArchived: vine.boolean().optional(),
})
