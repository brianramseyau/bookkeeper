import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ExcelJS from 'exceljs'
import env from '#start/env'
import User from '#models/user'
import { parseUsersSheet } from '#services/import/parse_users_sheet'

export default class extends BaseSeeder {
  async run() {
    const workbookPath = env.get('SEED_WORKBOOK_PATH')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(workbookPath)

    const sheet = workbook.getWorksheet('Users')
    if (!sheet) {
      throw new Error(`No "Users" sheet found in workbook at "${workbookPath}"`)
    }

    const rows = parseUsersSheet(sheet)
    if (rows.length === 0) {
      throw new Error(`"Users" sheet in workbook at "${workbookPath}" has no data rows`)
    }

    await User.updateOrCreateMany(
      'email',
      rows.map((row) => ({
        fullName: row.fullName,
        email: row.email,
        password: row.password,
      }))
    )
  }
}
