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
   * Manual "Backup Now" - writes a `manual`-tagged file, which the
   * automatic schedule never looks at (see `lastAutomaticBackupAt` in
   * `#services/backup_scheduler`), so a manual click can never push the
   * next automatic backup's due time out or suppress it.
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
