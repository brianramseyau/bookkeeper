import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import {
  createBackup,
  deleteBackup,
  listBackups,
  resolveBackupPath,
  type BackupFileInfo,
} from '#services/backup_service'

function serializeBackup(backup: BackupFileInfo) {
  return {
    filename: backup.filename,
    sizeBytes: backup.sizeBytes,
    createdAt: backup.createdAt.toISO(),
    source: backup.source,
  }
}

export default class BackupsController {
  async index() {
    const backups = await listBackups()
    return { data: backups.map(serializeBackup) }
  }

  /**
   * Manual "Backup Now" - deliberately does not touch the automatic
   * schedule's `lastRunAt`. It used to, which meant every manual click
   * pushed the next automatic backup out to "24h from now", so the
   * automatic cadence drifted to whenever someone last happened to click
   * the button instead of running on a stable schedule.
   */
  async store({ response }: HttpContext) {
    const backup = await createBackup(DateTime.utc(), 'manual')
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
