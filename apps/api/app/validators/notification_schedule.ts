import vine from '@vinejs/vine'

export const updateNotificationScheduleValidator = vine.create({
  sendHour: vine.number().min(0).max(23),
})
