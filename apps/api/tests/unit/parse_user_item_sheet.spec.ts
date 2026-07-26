import { test } from '@japa/runner'
import ExcelJS from 'exceljs'
import { parseUserItemSheet } from '#services/import/parse_user_item_sheet'

function buildSheet() {
  const workbook = new ExcelJS.Workbook()
  return workbook.addWorksheet('Brian')
}

test.group('parseUserItemSheet', () => {
  test('parses item name, amount and ordinal day-of-month', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(2)
    row.getCell(1).value = 'Netflix'
    row.getCell(2).value = 22.99
    row.getCell(3).value = '14th'

    const rows = parseUserItemSheet(sheet)

    assert.deepEqual(rows, [{ name: 'Netflix', amount: 22.99, dayOfMonth: 14 }])
  })

  test('parses 1st/2nd/3rd/21st style ordinals', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(2).getCell(1).value = 'A'
    sheet.getRow(2).getCell(2).value = 1
    sheet.getRow(2).getCell(3).value = '2nd'
    sheet.getRow(3).getCell(1).value = 'B'
    sheet.getRow(3).getCell(2).value = 1
    sheet.getRow(3).getCell(3).value = '21st'

    const rows = parseUserItemSheet(sheet)

    assert.equal(rows[0].dayOfMonth, 2)
    assert.equal(rows[1].dayOfMonth, 21)
  })

  test('returns null day-of-month for a blank date cell', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(2).getCell(1).value = 'Adobe'
    sheet.getRow(2).getCell(2).value = 9.99

    const rows = parseUserItemSheet(sheet)

    assert.isNull(rows[0].dayOfMonth)
  })

  test('stops at the trailing Total row', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(2).getCell(1).value = 'Netflix'
    sheet.getRow(2).getCell(2).value = 22.99
    sheet.getRow(3).getCell(1).value = 'Total'
    sheet.getRow(3).getCell(2).value = 22.99
    sheet.getRow(4).getCell(1).value = 'Should not be reached'
    sheet.getRow(4).getCell(2).value = 5

    const rows = parseUserItemSheet(sheet)

    assert.lengthOf(rows, 1)
    assert.equal(rows[0].name, 'Netflix')
  })

  test('stops at a blank name or a missing amount', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(2).getCell(1).value = 'Netflix'
    sheet.getRow(2).getCell(2).value = 22.99
    sheet.getRow(3).getCell(1).value = 'Kayo'

    const rows = parseUserItemSheet(sheet)

    assert.lengthOf(rows, 1)
  })

  test('reads amount from a formula-cell cached result', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(2).getCell(1).value = 'Kayo'
    sheet.getRow(2).getCell(2).value = { formula: 'B1', result: 45.99 } as unknown as number

    const rows = parseUserItemSheet(sheet)

    assert.equal(rows[0].amount, 45.99)
  })

  test('stops when the amount cell is a formula with a non-numeric cached result', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(2).getCell(1).value = 'Weird'
    sheet.getRow(2).getCell(2).value = { formula: 'B1', result: '#N/A' } as unknown as number

    const rows = parseUserItemSheet(sheet)

    assert.deepEqual(rows, [])
  })

  test('returns null day-of-month when the date cell text has no leading digits', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(2).getCell(1).value = 'Gym'
    sheet.getRow(2).getCell(2).value = 20
    sheet.getRow(2).getCell(3).value = 'TBD'

    const rows = parseUserItemSheet(sheet)

    assert.isNull(rows[0].dayOfMonth)
  })

  test('returns null day-of-month for an out-of-range day value', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(2).getCell(1).value = 'Weird'
    sheet.getRow(2).getCell(2).value = 10
    sheet.getRow(2).getCell(3).value = '45th'

    const rows = parseUserItemSheet(sheet)

    assert.isNull(rows[0].dayOfMonth)
  })
})
