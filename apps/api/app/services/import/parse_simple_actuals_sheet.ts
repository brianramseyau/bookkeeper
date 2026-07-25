import type { Worksheet } from 'exceljs'

export interface SimpleActualRow {
  occurredOn: string
  amount: number
  notes: string | null
}

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

/**
 * Parses the simple Date/Amount/Notes actuals sheets (Transport, Clothing):
 * one row per month, header on row 2. Stops at the first row with no
 * parseable date. A blank Amount (a future month not yet reached) is
 * skipped entirely, matching how the source data represents "no entry yet".
 */
export function parseSimpleActualsSheet(sheet: Worksheet): SimpleActualRow[] {
  const rows: SimpleActualRow[] = []
  let rowNumber = 3

  while (true) {
    const row = sheet.getRow(rowNumber)
    const date = cellDate(row.getCell(1).value)
    if (!date) break

    const amount = cellNumber(row.getCell(2).value)
    if (amount !== null) {
      const notesValue = row.getCell(3).value
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
