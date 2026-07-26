import vine from '@vinejs/vine'

export const upsertUtilityBillValidator = vine.create({
  amount: vine.number().min(0),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
  paid: vine.boolean().optional(),
})
