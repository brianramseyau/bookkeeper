import vine from '@vinejs/vine'

export const upsertMonthCarryoverValidator = vine.create({
  amount: vine.number(),
  notes: vine.string().trim().maxLength(500).nullable().optional(),
})
