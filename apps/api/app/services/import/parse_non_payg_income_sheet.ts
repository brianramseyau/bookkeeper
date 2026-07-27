import type { Worksheet } from 'exceljs'

export interface NonPaygIncomeRow {
  occurredOn: string
  item: string
  saleAmount: number
}

export interface NonPaygIncomeSheet {
  rows: NonPaygIncomeRow[]
  marginalRate: number | null
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
 * Parses the `Non-PAYG Income Tax` sheet: header on row 1 (with the
 * single household-wide `Marginal Rate` for the sheet's year sitting in
 * cell G1, alongside the column headers), one Date/Item/Sale row per
 * non-PAYG income event from row 2 onward. Stops at the first row with no
 * parseable date - the sheet's totals row has Sale/Tax/Gain sums but no
 * date, which naturally ends the scan the same way it does for
 * `parseSimpleActualsSheet`.
 */
export function parseNonPaygIncomeSheet(sheet: Worksheet): NonPaygIncomeSheet {
  const marginalRate = cellNumber(sheet.getRow(1).getCell(7).value)

  const rows: NonPaygIncomeRow[] = []
  let rowNumber = 2

  while (true) {
    const row = sheet.getRow(rowNumber)
    const date = cellDate(row.getCell(1).value)
    if (!date) break

    const item = row.getCell(2).value
    const saleAmount = cellNumber(row.getCell(3).value)
    if (typeof item === 'string' && item.trim() !== '' && saleAmount !== null) {
      rows.push({ occurredOn: isoDate(date), item: item.trim(), saleAmount })
    }

    rowNumber += 1
  }

  return { rows, marginalRate }
}
