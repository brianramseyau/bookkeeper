import vine from '@vinejs/vine'

export const updateBackupSettingValidator = vine.create({
  enabled: vine.boolean(),
  intervalHours: vine.number().min(1).max(720),
  retentionDays: vine.number().min(1).max(365),
  runHour: vine.number().min(0).max(23),
})
