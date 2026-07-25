import type { Worksheet } from 'exceljs'
import type { SimpleActualRow } from '#services/import/parse_simple_actuals_sheet'

function cellNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'result' in (value as Record<string, unknown>)) {
    const result = (value as { result: unknown }).result
    return typeof result === 'number' ? result : null
  }
  return null
}

function cellDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (value && typeof value === 'object' && 'result' in (value as Record<string, unknown>)) {
    const result = (value as { result: unknown }).result
    return result instanceof Date ? result : null
  }
  return null
}

function isoDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseBlock(sheet: Worksheet, dateColumn: number): SimpleActualRow[] {
  const rows: SimpleActualRow[] = []
  let rowNumber = 3

  while (true) {
    const row = sheet.getRow(rowNumber)
    const date = cellDate(row.getCell(dateColumn).value)
    if (!date) break

    const amount = cellNumber(row.getCell(dateColumn + 1).value)
    if (amount !== null) {
      const notesValue = row.getCell(dateColumn + 2).value
      rows.push({
        occurredOn: isoDate(date),
        amount,
        notes:
          typeof notesValue === 'string' && notesValue.trim() !== '' ? notesValue.trim() : null,
      })
    }

    rowNumber += 1
  }

  return rows
}

/**
 * Parses the "Food" sheet's two-block layout: Groceries in columns A-C,
 * Takeaways in columns E-G (offset by a blank column D), each shaped like
 * the simple Date/Amount/Notes actuals sheets.
 */
export function parseFoodSheet(sheet: Worksheet): {
  groceries: SimpleActualRow[]
  takeaways: SimpleActualRow[]
} {
  return {
    groceries: parseBlock(sheet, 1),
    takeaways: parseBlock(sheet, 5),
  }
}
