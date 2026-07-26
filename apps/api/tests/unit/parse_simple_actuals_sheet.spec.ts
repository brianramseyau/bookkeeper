import { test } from '@japa/runner'
import ExcelJS from 'exceljs'
import { parseSimpleActualsSheet } from '#services/import/parse_simple_actuals_sheet'

function buildSheet() {
  const workbook = new ExcelJS.Workbook()
  return workbook.addWorksheet('Transport')
}

test.group('parseSimpleActualsSheet', () => {
  test('parses date, amount and notes starting on row 3', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(3)
    row.getCell(1).value = new Date(Date.UTC(2026, 1, 1))
    row.getCell(2).value = 120.5
    row.getCell(3).value = 'Fuel + tolls'

    const rows = parseSimpleActualsSheet(sheet)

    assert.deepEqual(rows, [{ occurredOn: '2026-02-01', amount: 120.5, notes: 'Fuel + tolls' }])
  })

  test('treats a blank notes cell as null, not an empty string', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(3)
    row.getCell(1).value = new Date(Date.UTC(2026, 1, 1))
    row.getCell(2).value = 120.5

    const rows = parseSimpleActualsSheet(sheet)

    assert.isNull(rows[0].notes)
  })

  test('skips a row with a blank amount rather than treating it as zero', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(3).getCell(1).value = new Date(Date.UTC(2026, 1, 1))
    sheet.getRow(4).getCell(1).value = new Date(Date.UTC(2026, 2, 1))
    sheet.getRow(4).getCell(2).value = 50

    const rows = parseSimpleActualsSheet(sheet)

    assert.deepEqual(rows, [{ occurredOn: '2026-03-01', amount: 50, notes: null }])
  })

  test('stops at the first row with no parseable date', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(3).getCell(1).value = new Date(Date.UTC(2026, 1, 1))
    sheet.getRow(3).getCell(2).value = 50
    sheet.getRow(4).getCell(2).value = 999

    const rows = parseSimpleActualsSheet(sheet)

    assert.lengthOf(rows, 1)
  })

  test('reads date and amount from formula-cell cached results', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(3)
    row.getCell(1).value = {
      formula: 'A1',
      result: new Date(Date.UTC(2026, 3, 15)),
    } as unknown as Date
    row.getCell(2).value = { formula: 'B1', result: 75 } as unknown as number

    const rows = parseSimpleActualsSheet(sheet)

    assert.deepEqual(rows, [{ occurredOn: '2026-04-15', amount: 75, notes: null }])
  })

  test('treats a formula cell with a non-date cached result as unparseable', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(3)
    row.getCell(1).value = { formula: 'A1', result: 'not-a-date' } as unknown as Date
    row.getCell(2).value = 50

    const rows = parseSimpleActualsSheet(sheet)

    assert.deepEqual(rows, [])
  })

  test('treats a formula cell with a non-numeric cached amount as blank (not zero)', ({
    assert,
  }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(3)
    row.getCell(1).value = new Date(Date.UTC(2026, 1, 1))
    row.getCell(2).value = { formula: 'B1', result: '#N/A' } as unknown as number

    const rows = parseSimpleActualsSheet(sheet)

    assert.deepEqual(rows, [])
  })
})
