import vine from '@vinejs/vine'

export const createIncomeEntryValidator = vine.create({
  incomeSourceId: vine.number().positive().nullable().optional(),
  userId: vine.number().positive().nullable().optional(),
  year: vine.number().min(2000).max(2100),
  month: vine.number().min(1).max(12),
  receivedOn: vine.date().nullable().optional(),
  amount: vine.number().min(0),
  note: vine.string().trim().maxLength(160).nullable().optional(),
})

export const updateIncomeEntryValidator = vine.create({
  incomeSourceId: vine.number().positive().nullable().optional(),
  userId: vine.number().positive().nullable().optional(),
  year: vine.number().min(2000).max(2100).optional(),
  month: vine.number().min(1).max(12).optional(),
  receivedOn: vine.date().nullable().optional(),
  amount: vine.number().min(0).optional(),
  note: vine.string().trim().maxLength(160).nullable().optional(),
})
