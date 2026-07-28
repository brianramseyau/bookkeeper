import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import {
  createBackup,
  deleteBackup,
  listBackups,
  resolveBackupPath,
  purgeExpired,
  type BackupFileInfo,
} from '#services/backup_service'
import { getBackupSettings } from '#services/backup_scheduler'

function serializeBackup(backup: BackupFileInfo) {
  return {
    filename: backup.filename,
    sizeBytes: backup.sizeBytes,
    createdAt: backup.createdAt.toISO(),
  }
}

export default class BackupsController {
  async index() {
    const backups = await listBackups()
    return { data: backups.map(serializeBackup) }
  }

  /** Manual "Backup Now" - also purges expired backups and pushes out the automatic schedule, same as a scheduled run would. */
  async store({ response }: HttpContext) {
    const now = DateTime.utc()
    const backup = await createBackup(now)

    const settings = await getBackupSettings()
    await purgeExpired(settings.retentionDays, now)
    settings.lastRunAt = now
    await settings.save()

    return response.created({ data: serializeBackup(backup) })
  }

  async destroy({ params, response }: HttpContext) {
    const deleted = await deleteBackup(params.filename)
    if (!deleted) {
      return response.notFound({ message: `Backup "${params.filename}" not found` })
    }
    return response.noContent()
  }

  async download({ params, response }: HttpContext) {
    const filePath = resolveBackupPath(params.filename)
    if (!filePath) {
      return response.notFound({ message: `Backup "${params.filename}" not found` })
    }
    return response.attachment(filePath)
  }
}
