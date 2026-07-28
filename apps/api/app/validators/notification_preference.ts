import vine from '@vinejs/vine'

export const updateNotificationPreferenceValidator = vine.create({
  enabled: vine.boolean(),
  leadDays: vine.number().min(0).max(30),
  notifyUtilityBills: vine.boolean(),
  notifyRecurringBills: vine.boolean(),
  notifySubscriptions: vine.boolean(),
})
