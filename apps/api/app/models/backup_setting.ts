import { BackupSettingSchema } from '#database/schema'

/**
 * Single household-wide row (always `id: 1`, see `BackupService.settings`)
 * holding the automatic backup schedule.
 */
export default class BackupSetting extends BackupSettingSchema {}
