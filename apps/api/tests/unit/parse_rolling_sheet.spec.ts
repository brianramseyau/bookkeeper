import { test } from '@japa/runner'
import ExcelJS from 'exceljs'
import { parseRollingSheet } from '#services/import/parse_rolling_sheet'

function buildSheet() {
  const workbook = new ExcelJS.Workbook()
  return workbook.addWorksheet('Rolling')
}

/** Writes a "Month" marker row followed by a header row, per the sheet's block layout. */
function writeBlockHeader(
  sheet: ReturnType<typeof buildSheet>,
  rowNumber: number,
  monthName: string
) {
  sheet.getRow(rowNumber).getCell(1).value = 'Month'
  sheet.getRow(rowNumber).getCell(2).value = monthName
  sheet.getRow(rowNumber + 1).getCell(1).value = 'Income'
  sheet.getRow(rowNumber + 1).getCell(2).value = 'Budget'
  sheet.getRow(rowNumber + 1).getCell(3).value = 'Actual'
  sheet.getRow(rowNumber + 1).getCell(4).value = 'Note'
  sheet.getRow(rowNumber + 1).getCell(5).value = 'DoM'
}

test.group('parseRollingSheet', () => {
  test('parses a single month block into entries and an income block', ({ assert }) => {
    const sheet = buildSheet()
    writeBlockHeader(sheet, 1, 'February')

    const dataRow = sheet.getRow(3)
    dataRow.getCell(1).value = 5000
    dataRow.getCell(2).value = 400
    dataRow.getCell(3).value = 409.08
    dataRow.getCell(4).value = 'Electricity Bill'
    dataRow.getCell(5).value = 15

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.deepEqual(result.entries, [
      {
        year: 2026,
        month: 2,
        note: 'Electricity Bill',
        budget: 400,
        actual: 409.08,
        dayOfMonth: 15,
      },
    ])
    assert.deepEqual(result.income, [{ year: 2026, month: 2, values: [5000] }])
  })

  test('a block ends at the first row with a blank Note', ({ assert }) => {
    const sheet = buildSheet()
    writeBlockHeader(sheet, 1, 'February')
    sheet.getRow(3).getCell(4).value = 'Groceries'
    sheet.getRow(3).getCell(3).value = 200
    sheet.getRow(4).getCell(4).value = undefined
    sheet.getRow(5).getCell(4).value = 'Should not be reached'

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.lengthOf(result.entries, 1)
    assert.equal(result.entries[0].note, 'Groceries')
  })

  test('income values are collected independently of note rows, in row order', ({ assert }) => {
    const sheet = buildSheet()
    writeBlockHeader(sheet, 1, 'February')
    const first = sheet.getRow(3)
    first.getCell(1).value = 2500
    first.getCell(4).value = 'Groceries'
    const second = sheet.getRow(4)
    second.getCell(1).value = 2600
    second.getCell(4).value = 'Takeaway'
    const third = sheet.getRow(5)
    third.getCell(4).value = 'Dog'

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.deepEqual(result.income[0].values, [2500, 2600])
    assert.lengthOf(result.entries, 3)
  })

  test('advances the year when a block month does not increase from the previous block', ({
    assert,
  }) => {
    const sheet = buildSheet()
    writeBlockHeader(sheet, 1, 'November')
    sheet.getRow(3).getCell(4).value = 'Rent'

    writeBlockHeader(sheet, 4, 'December')
    sheet.getRow(6).getCell(4).value = 'Rent'

    writeBlockHeader(sheet, 7, 'January')
    sheet.getRow(9).getCell(4).value = 'Rent'

    const result = parseRollingSheet(sheet, 2025, 11)

    assert.deepEqual(
      result.entries.map((entry) => [entry.year, entry.month]),
      [
        [2025, 11],
        [2025, 12],
        [2026, 1],
      ]
    )
  })

  test('skips rows in column 1 that are not a "Month" marker', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).getCell(1).value = 'Some unrelated label'
    writeBlockHeader(sheet, 2, 'February')
    sheet.getRow(4).getCell(4).value = 'Groceries'

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.lengthOf(result.entries, 1)
    assert.deepEqual(result.income, [{ year: 2026, month: 2, values: [] }])
  })

  test('skips a "Month" row whose month name is unrecognized', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).getCell(1).value = 'Month'
    sheet.getRow(1).getCell(2).value = 'Notamonth'
    writeBlockHeader(sheet, 2, 'February')
    sheet.getRow(4).getCell(4).value = 'Groceries'

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.lengthOf(result.income, 1)
    assert.equal(result.income[0].month, 2)
  })

  test('handles multiple consecutive blocks', ({ assert }) => {
    const sheet = buildSheet()
    writeBlockHeader(sheet, 1, 'February')
    sheet.getRow(3).getCell(4).value = 'Groceries'
    sheet.getRow(3).getCell(3).value = 400

    writeBlockHeader(sheet, 5, 'March')
    sheet.getRow(7).getCell(4).value = 'Groceries'
    sheet.getRow(7).getCell(3).value = 420

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.lengthOf(result.entries, 2)
    assert.lengthOf(result.income, 2)
    assert.deepEqual(
      result.income.map((block) => block.month),
      [2, 3]
    )
  })

  test('treats a formula cell with a non-numeric cached result as blank', ({ assert }) => {
    const sheet = buildSheet()
    writeBlockHeader(sheet, 1, 'February')
    const row = sheet.getRow(3)
    row.getCell(1).value = { formula: 'A1', result: '#N/A' } as unknown as number
    row.getCell(4).value = 'Groceries'

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.deepEqual(result.income[0].values, [])
    assert.isNull(result.entries[0].budget)
  })

  test('skips a "Month" row whose month-name cell is not a string', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).getCell(1).value = 'Month'
    sheet.getRow(1).getCell(2).value = 2026
    writeBlockHeader(sheet, 2, 'February')
    sheet.getRow(4).getCell(4).value = 'Groceries'

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.lengthOf(result.income, 1)
    assert.equal(result.income[0].month, 2)
  })

  test('reads numeric cells from formula-cell cached results', ({ assert }) => {
    const sheet = buildSheet()
    writeBlockHeader(sheet, 1, 'February')
    const row = sheet.getRow(3)
    row.getCell(1).value = { formula: 'A1', result: 5000 } as unknown as number
    row.getCell(2).value = { formula: 'B1', result: 400 } as unknown as number
    row.getCell(3).value = { formula: 'C1', result: 409.08 } as unknown as number
    row.getCell(4).value = 'Electricity Bill'
    row.getCell(5).value = { formula: 'E1', result: 15 } as unknown as number

    const result = parseRollingSheet(sheet, 2026, 2)

    assert.deepEqual(result.entries[0], {
      year: 2026,
      month: 2,
      note: 'Electricity Bill',
      budget: 400,
      actual: 409.08,
      dayOfMonth: 15,
    })
    assert.deepEqual(result.income[0].values, [5000])
  })
})
