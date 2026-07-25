import type { Worksheet } from 'exceljs'

export interface UserItemRow {
  name: string
  amount: number
  dayOfMonth: number | null
}

function cellNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'result' in (value as Record<string, unknown>)) {
    const result = (value as { result: unknown }).result
    return typeof result === 'number' ? result : null
  }
  return null
}

/**
 * Parses the day-of-month component out of an ordinal string like "2nd",
 * "14th", "21st" - the format the Brian/Ariel sheets use for their Date
 * column. Returns null for blank cells (some items have no fixed date).
 */
function parseDayOfMonth(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{1,2})/)
  if (!match) return null
  const day = Number(match[1])
  return day >= 1 && day <= 31 ? day : null
}

/**
 * Parses the Brian/Ariel personal-subscription sheets: columns Item,
 * Amount, Date. Stops at the first row with no item name or amount, which
 * naturally skips the trailing "Total" row these sheets end with.
 */
export function parseUserItemSheet(sheet: Worksheet): UserItemRow[] {
  const rows: UserItemRow[] = []
  let rowNumber = 2

  while (true) {
    const row = sheet.getRow(rowNumber)
    const nameValue = row.getCell(1).value
    const amount = cellNumber(row.getCell(2).value)

    if (typeof nameValue !== 'string' || nameValue.trim() === '') break
    if (nameValue.trim().toLowerCase() === 'total') break
    if (amount === null) break

    rows.push({
      name: nameValue.trim(),
      amount,
      dayOfMonth: parseDayOfMonth(row.getCell(3).value),
    })

    rowNumber += 1
  }

  return rows
}
