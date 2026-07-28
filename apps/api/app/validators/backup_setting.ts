import vine from '@vinejs/vine'

export const updateBackupSettingValidator = vine.create({
  enabled: vine.boolean(),
  intervalHours: vine.number().min(1).max(720),
  retentionDays: vine.number().min(1).max(365),
})
