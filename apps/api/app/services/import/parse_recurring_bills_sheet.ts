import type { Worksheet } from 'exceljs'

export interface RecurringBillRow {
  name: string
  amount: number
  dueDay: number | null
  dueMonth: number | null
  dueYear: number | null
  /** ISO date (YYYY-MM-DD), or null if the sheet had no "Next" value. */
  nextDueOn: string | null
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
 * Parses the "Annual" sheet: columns Item, Amount, Day/Month, Year, Next.
 * "Day/Month" and "Year" only matter for their day/month/year components
 * (the year embedded in the Day/Month cell's date is stale/arbitrary) -
 * "Next" is the sheet's one authoritative, currently-correct due date.
 * Stops at the first row with no parseable Day/Month date, which naturally
 * skips the trailing Totals/avg-per-month summary rows.
 */
export function parseRecurringBillsSheet(sheet: Worksheet): RecurringBillRow[] {
  const rows: RecurringBillRow[] = []
  let rowNumber = 2

  while (true) {
    const row = sheet.getRow(rowNumber)
    const nameValue = row.getCell(1).value
    const dayMonthDate = cellDate(row.getCell(3).value)

    if (typeof nameValue !== 'string' || nameValue.trim() === '' || !dayMonthDate) break

    const amount = cellNumber(row.getCell(2).value) ?? 0
    const dueYear = cellNumber(row.getCell(4).value)
    const nextDate = cellDate(row.getCell(5).value)

    rows.push({
      name: nameValue.trim(),
      amount,
      dueDay: dayMonthDate.getUTCDate(),
      dueMonth: dayMonthDate.getUTCMonth() + 1,
      dueYear,
      nextDueOn: nextDate ? isoDate(nextDate) : null,
    })

    rowNumber += 1
  }

  return rows
}
