import type BackupSetting from '#models/backup_setting'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class BackupSettingTransformer extends BaseTransformer<BackupSetting> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'intervalHours',
        'retentionDays',
        'runHour',
        'lastRunAt',
        'createdAt',
        'updatedAt',
      ]),
      // SQLite has no native boolean type - a row just read back from the DB
      // (rather than set in this same JS process) carries the raw 0/1 it's
      // stored as, so coerce to a real boolean at the API boundary.
      enabled: Boolean(this.resource.enabled),
    }
  }
}
