import type { Worksheet } from 'exceljs'

export interface RollingEntry {
  year: number
  month: number
  note: string
  budget: number | null
  actual: number | null
  dayOfMonth: number | null
}

export interface RollingIncomeBlock {
  year: number
  month: number
  /** Income column values in row order, top to bottom - not aligned to any note. */
  values: number[]
}

export interface RollingSheetResult {
  entries: RollingEntry[]
  income: RollingIncomeBlock[]
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
  return null
}

function monthNameToNumber(name: string): number | null {
  const index = MONTH_NAMES.indexOf(name.trim().toLowerCase())
  return index === -1 ? null : index + 1
}

/**
 * Parses the "Rolling" sheet: a sequence of month blocks (each starting
 * with a "Month" / <month name> row, followed by an Income/Budget/Actual/
 * Note/DoM header, then data rows keyed by a free-text Note). The sheet
 * doesn't label blocks with a year, so the caller supplies the first
 * block's year/month and this walks forward from there - a block's year
 * only advances when its month number doesn't increase from the previous
 * block (handles wraparound; this dataset's 8 blocks never actually wrap).
 * A block ends at the first row with a blank Note.
 */
export function parseRollingSheet(
  sheet: Worksheet,
  startYear: number,
  startMonth: number
): RollingSheetResult {
  const entries: RollingEntry[] = []
  const income: RollingIncomeBlock[] = []
  let year = startYear
  let previousMonth = startMonth - 1
  const maxRow = sheet.rowCount

  let rowNumber = 1
  while (rowNumber <= maxRow) {
    const row = sheet.getRow(rowNumber)
    const col1 = row.getCell(1).value

    if (typeof col1 !== 'string' || col1.trim().toLowerCase() !== 'month') {
      rowNumber += 1
      continue
    }

    const monthNameValue = row.getCell(2).value
    const monthNumber =
      typeof monthNameValue === 'string' ? monthNameToNumber(monthNameValue) : null
    if (monthNumber === null) {
      rowNumber += 1
      continue
    }

    if (monthNumber <= previousMonth) year += 1
    previousMonth = monthNumber

    // Skip this "Month" row and the Income/Budget/Actual/Note/DoM header row.
    rowNumber += 2

    const incomeValues: number[] = []

    while (rowNumber <= maxRow) {
      const dataRow = sheet.getRow(rowNumber)
      const noteValue = dataRow.getCell(4).value
      if (typeof noteValue !== 'string' || noteValue.trim() === '') break

      const incomeValue = cellNumber(dataRow.getCell(1).value)
      if (incomeValue !== null) incomeValues.push(incomeValue)

      entries.push({
        year,
        month: monthNumber,
        note: noteValue.trim(),
        budget: cellNumber(dataRow.getCell(2).value),
        actual: cellNumber(dataRow.getCell(3).value),
        dayOfMonth: cellNumber(dataRow.getCell(5).value),
      })

      rowNumber += 1
    }

    income.push({ year, month: monthNumber, values: incomeValues })
  }

  return { entries, income }
}
