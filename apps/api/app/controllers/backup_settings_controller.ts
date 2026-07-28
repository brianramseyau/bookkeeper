import type { HttpContext } from '@adonisjs/core/http'
import { getBackupSettings } from '#services/backup_scheduler'
import BackupSettingTransformer from '#transformers/backup_setting_transformer'
import { updateBackupSettingValidator } from '#validators/backup_setting'

export default class BackupSettingsController {
  async show({ serialize }: HttpContext) {
    const settings = await getBackupSettings()
    return serialize(BackupSettingTransformer.transform(settings))
  }

  async update({ request, serialize }: HttpContext) {
    const payload = await request.validateUsing(updateBackupSettingValidator)
    const settings = await getBackupSettings()
    settings.merge(payload)
    await settings.save()
    return serialize(BackupSettingTransformer.transform(settings))
  }
}
