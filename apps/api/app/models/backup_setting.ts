import { BackupSettingSchema } from '#database/schema'

export type BackupFrequency = 'daily' | 'weekly' | 'monthly'

/**
 * Single household-wide row (always `id: 1`, see
 * `#services/backup_scheduler`'s `getBackupSettings`) holding the automatic
 * backup schedule.
 */
export default class BackupSetting extends BackupSettingSchema {}
