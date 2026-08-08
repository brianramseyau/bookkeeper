import vine from '@vinejs/vine'

const FREQUENCIES = ['monthly', 'quarterly', 'biannual', 'annual', 'biennial', 'triennial'] as const

export const createRecurringBillValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(160),
  categoryId: vine.number().positive().nullable().optional(),
  amount: vine.number().min(0),
  frequency: vine.enum(FREQUENCIES),
  // A one-off anchor date the caller picks (e.g. "this bill is next due on
  // 2026-03-17") - only its day/month are kept (see the controller), since
  // the bill's due date then repeats from that day/month indefinitely and
  // the year itself is never stored.
  nextDueOn: vine.date(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})

export const updateRecurringBillValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(160).optional(),
  categoryId: vine.number().positive().nullable().optional(),
  amount: vine.number().min(0).optional(),
  frequency: vine.enum(FREQUENCIES).optional(),
  nextDueOn: vine.date().optional(),
  isActive: vine.boolean().optional(),
  isPaused: vine.boolean().optional(),
  isArchived: vine.boolean().optional(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})
