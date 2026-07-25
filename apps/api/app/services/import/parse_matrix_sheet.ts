import type { Worksheet } from 'exceljs'

export interface MatrixEntry {
  year: number
  month: number
  amount: number
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

function cellNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'result' in (value as Record<string, unknown>)) {
    const result = (value as { result: unknown }).result
    return typeof result === 'number' ? result : null
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Parses a Month x Year matrix worksheet (Electricity/Gas/Water): row 1 is a
 * header (Month, then one column per year), each following row is a month
 * name with one amount per year column. Stops at the first row whose first
 * cell isn't a recognized month name - this naturally skips trailing
 * Year/Total/avg summary rows some of these sheets have below the matrix.
 * A blank cell (no bill recorded for that month) is skipped entirely rather
 * than treated as zero.
 */
export function parseMatrixSheet(sheet: Worksheet): MatrixEntry[] {
  const headerRow = sheet.getRow(1)
  const yearByColumn = new Map<number, number>()
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber === 1) return
    const year = cellNumber(cell.value)
    if (year !== null && Number.isInteger(year) && year > 1900) {
      yearByColumn.set(colNumber, year)
    }
  })

  const entries: MatrixEntry[] = []
  let rowNumber = 2

  while (true) {
    const row = sheet.getRow(rowNumber)
    const monthLabel = String(row.getCell(1).value ?? '')
      .trim()
      .toLowerCase()
    const monthIndex = MONTH_NAMES.indexOf(monthLabel)
    if (monthIndex === -1) break

    for (const [colNumber, year] of yearByColumn) {
      const amount = cellNumber(row.getCell(colNumber).value)
      if (amount !== null) {
        entries.push({ year, month: monthIndex + 1, amount })
      }
    }

    rowNumber += 1
  }

  return entries
}
