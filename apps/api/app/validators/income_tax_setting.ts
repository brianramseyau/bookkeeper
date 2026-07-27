import vine from '@vinejs/vine'

export const upsertIncomeTaxSettingValidator = vine.create({
  userId: vine.number().positive(),
  financialYear: vine.number().min(2000).max(2100),
  marginalRate: vine.number().min(0).max(1),
})
