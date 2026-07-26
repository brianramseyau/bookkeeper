import { test } from '@japa/runner'
import ExcelJS from 'exceljs'
import { parseMatrixSheet } from '#services/import/parse_matrix_sheet'

function buildSheet(rows: (string | number)[][]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Matrix')
  rows.forEach((row, index) => {
    sheet.getRow(index + 1).values = row
  })
  return sheet
}

test.group('parseMatrixSheet', () => {
  test('parses amounts keyed by year column and month row', ({ assert }) => {
    const sheet = buildSheet([
      ['Month', 2025, 2026],
      ['January', 100, 150],
      ['February', 110, 160],
    ])

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [
      { year: 2025, month: 1, amount: 100 },
      { year: 2026, month: 1, amount: 150 },
      { year: 2025, month: 2, amount: 110 },
      { year: 2026, month: 2, amount: 160 },
    ])
  })

  test('skips blank cells rather than treating them as zero', ({ assert }) => {
    const sheet = buildSheet([
      ['Month', 2026],
      ['January', undefined as unknown as string],
    ])

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [])
  })

  test('stops at the first row whose label is not a month name', ({ assert }) => {
    const sheet = buildSheet([
      ['Month', 2026],
      ['January', 100],
      ['Total', 100],
      ['February', 200],
    ])

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [{ year: 2026, month: 1, amount: 100 }])
  })

  test('ignores header columns that are not a plausible year', ({ assert }) => {
    const sheet = buildSheet([
      ['Month', 'Notes', 2026],
      ['January', 'some note', 100],
    ])

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [{ year: 2026, month: 1, amount: 100 }])
  })

  test('reads a formula cell via its cached result', ({ assert }) => {
    const sheet = buildSheet([['Month', 2026]])
    sheet.getRow(2).getCell(1).value = 'January'
    sheet.getRow(2).getCell(2).value = { formula: 'A1', result: 250 } as unknown as string

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [{ year: 2026, month: 1, amount: 250 }])
  })

  test('is case-insensitive and trims whitespace on month labels', ({ assert }) => {
    const sheet = buildSheet([['Month', 2026]])
    sheet.getRow(2).getCell(1).value = '  JANUARY  '
    sheet.getRow(2).getCell(2).value = 100

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [{ year: 2026, month: 1, amount: 100 }])
  })

  test('treats a formula cell with a non-numeric cached result as blank', ({ assert }) => {
    const sheet = buildSheet([['Month', 2026]])
    sheet.getRow(2).getCell(1).value = 'January'
    sheet.getRow(2).getCell(2).value = { formula: 'A1', result: '#DIV/0!' } as unknown as string

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [])
  })

  test('parses a numeric string cell as a number', ({ assert }) => {
    const sheet = buildSheet([['Month', 2026]])
    sheet.getRow(2).getCell(1).value = 'January'
    sheet.getRow(2).getCell(2).value = '150'

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [{ year: 2026, month: 1, amount: 150 }])
  })

  test('treats an unparseable numeric string as blank', ({ assert }) => {
    const sheet = buildSheet([['Month', 2026]])
    sheet.getRow(2).getCell(1).value = 'January'
    sheet.getRow(2).getCell(2).value = 'N/A'

    const entries = parseMatrixSheet(sheet)

    assert.deepEqual(entries, [])
  })
})
