import type { Worksheet } from 'exceljs'

export interface UserSheetRow {
  fullName: string
  email: string
  password: string
}

function cellText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  if (value && typeof value === 'object') {
    // mailto: cells (e.g. an Email column) come through as a hyperlink
    // object rather than a plain string.
    const text = (value as { text?: unknown }).text
    if (typeof text === 'string') {
      const trimmed = text.trim()
      return trimmed === '' ? null : trimmed
    }
  }
  return null
}

/**
 * Parses the Users sheet: columns Name, Email, Password, header on row 1.
 * Stops at the first row missing any of the three values.
 */
export function parseUsersSheet(sheet: Worksheet): UserSheetRow[] {
  const rows: UserSheetRow[] = []
  let rowNumber = 2

  while (true) {
    const row = sheet.getRow(rowNumber)
    const fullName = cellText(row.getCell(1).value)
    const email = cellText(row.getCell(2).value)
    const password = cellText(row.getCell(3).value)

    if (!fullName || !email || !password) break

    rows.push({ fullName, email, password })
    rowNumber += 1
  }

  return rows
}
