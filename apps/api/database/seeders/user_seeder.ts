import { BaseSeeder } from '@adonisjs/lucid/seeders'
import ExcelJS from 'exceljs'
import env from '#start/env'
import User from '#models/user'
import { parseUsersSheet } from '#services/import/parse_users_sheet'

export default class extends BaseSeeder {
  // Reads a real xlsx workbook - only meaningful outside tests, which use
  // test_user_seeder.ts's hardcoded Adam/Eve instead.
  static environment = ['development', 'production']

  async run() {
    const workbookPath = env.get('SEED_WORKBOOK_PATH')
    if (!workbookPath) {
      throw new Error('SEED_WORKBOOK_PATH must be set to run this seeder')
    }

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

    for (const row of rows) {
      const user = await User.updateOrCreate(
        { email: row.email },
        { fullName: row.fullName, password: row.password }
      )

      // Only overwrite displayColor when the sheet actually provides one -
      // preserves a color set manually via the app's settings page for
      // users the sheet leaves blank.
      if (row.displayColor && user.displayColor !== row.displayColor) {
        user.displayColor = row.displayColor
        await user.save()
      }
    }
  }
}
