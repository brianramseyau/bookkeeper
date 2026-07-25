import vine from '@vinejs/vine'

const FREQUENCIES = ['monthly', 'quarterly', 'biannual', 'annual', 'custom'] as const
const CUSTOM_INTERVAL_UNITS = ['days', 'weeks', 'months'] as const

export const createRecurringBillValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(160),
  categoryId: vine.number().positive().nullable().optional(),
  amount: vine.number().min(0),
  frequency: vine.enum(FREQUENCIES),
  customIntervalValue: vine.number().positive().optional().requiredWhen('frequency', '=', 'custom'),
  customIntervalUnit: vine
    .enum(CUSTOM_INTERVAL_UNITS)
    .optional()
    .requiredWhen('frequency', '=', 'custom'),
  nextDueOn: vine.date(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})

export const updateRecurringBillValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(160).optional(),
  categoryId: vine.number().positive().nullable().optional(),
  amount: vine.number().min(0).optional(),
  frequency: vine.enum(FREQUENCIES).optional(),
  customIntervalValue: vine.number().positive().nullable().optional(),
  customIntervalUnit: vine.enum(CUSTOM_INTERVAL_UNITS).nullable().optional(),
  nextDueOn: vine.date().optional(),
  isActive: vine.boolean().optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})
