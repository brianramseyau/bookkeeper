import vine from '@vinejs/vine'

const FREQUENCIES = ['monthly', 'fortnightly'] as const

export const createIncomeSourceValidator = vine.create({
  userId: vine.number().positive(),
  name: vine.string().trim().minLength(1).maxLength(160),
  expectedAmount: vine.number().min(0),
  frequency: vine.enum(FREQUENCIES),
  payDayOfMonth: vine.number().min(1).max(31).optional().requiredWhen('frequency', '=', 'monthly'),
  weekendRollback: vine.boolean().optional(),
  anchorDate: vine.date().optional().requiredWhen('frequency', '=', 'fortnightly'),
  taxWithheld: vine.boolean().optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})

export const updateIncomeSourceValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(160).optional(),
  expectedAmount: vine.number().min(0).optional(),
  frequency: vine.enum(FREQUENCIES).optional(),
  payDayOfMonth: vine.number().min(1).max(31).nullable().optional(),
  weekendRollback: vine.boolean().optional(),
  anchorDate: vine.date().nullable().optional(),
  taxWithheld: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})
