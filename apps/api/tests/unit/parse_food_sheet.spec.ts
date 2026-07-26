import { test } from '@japa/runner'
import ExcelJS from 'exceljs'
import { parseFoodSheet } from '#services/import/parse_food_sheet'

function buildSheet() {
  const workbook = new ExcelJS.Workbook()
  return workbook.addWorksheet('Food')
}

test.group('parseFoodSheet', () => {
  test('parses groceries from columns A-C and takeaways from E-G independently', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(3)
    row.getCell(1).value = new Date(Date.UTC(2026, 1, 1))
    row.getCell(2).value = 200
    row.getCell(3).value = 'Weekly shop'
    row.getCell(5).value = new Date(Date.UTC(2026, 1, 5))
    row.getCell(6).value = 45
    row.getCell(7).value = 'Thai'

    const result = parseFoodSheet(sheet)

    assert.deepEqual(result.groceries, [
      { occurredOn: '2026-02-01', amount: 200, notes: 'Weekly shop' },
    ])
    assert.deepEqual(result.takeaways, [{ occurredOn: '2026-02-05', amount: 45, notes: 'Thai' }])
  })

  test('each block stops independently at its own first unparseable date', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(3).getCell(1).value = new Date(Date.UTC(2026, 1, 1))
    sheet.getRow(3).getCell(2).value = 200
    sheet.getRow(4).getCell(1).value = new Date(Date.UTC(2026, 2, 1))
    sheet.getRow(4).getCell(2).value = 210

    sheet.getRow(3).getCell(5).value = new Date(Date.UTC(2026, 1, 5))
    sheet.getRow(3).getCell(6).value = 45

    const result = parseFoodSheet(sheet)

    assert.lengthOf(result.groceries, 2)
    assert.lengthOf(result.takeaways, 1)
  })

  test('an empty sheet yields empty groceries and takeaways arrays', ({ assert }) => {
    const sheet = buildSheet()

    const result = parseFoodSheet(sheet)

    assert.deepEqual(result, { groceries: [], takeaways: [] })
  })

  test('reads date and amount from formula-cell cached results', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(3)
    row.getCell(1).value = {
      formula: 'A1',
      result: new Date(Date.UTC(2026, 1, 1)),
    } as unknown as Date
    row.getCell(2).value = { formula: 'B1', result: 200 } as unknown as number

    const result = parseFoodSheet(sheet)

    assert.deepEqual(result.groceries, [{ occurredOn: '2026-02-01', amount: 200, notes: null }])
  })

  test('skips a row with a blank amount cell rather than treating it as zero', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(3).getCell(1).value = new Date(Date.UTC(2026, 1, 1))
    sheet.getRow(4).getCell(1).value = new Date(Date.UTC(2026, 2, 1))
    sheet.getRow(4).getCell(2).value = 210

    const result = parseFoodSheet(sheet)

    assert.deepEqual(result.groceries, [{ occurredOn: '2026-03-01', amount: 210, notes: null }])
  })

  test('treats a formula cell with a non-numeric or non-date cached result as blank', ({
    assert,
  }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(3)
    row.getCell(1).value = { formula: 'A1', result: '#N/A' } as unknown as Date
    row.getCell(5).value = new Date(Date.UTC(2026, 1, 5))
    row.getCell(6).value = { formula: 'F1', result: '#N/A' } as unknown as number

    const result = parseFoodSheet(sheet)

    assert.deepEqual(result.groceries, [])
    assert.deepEqual(result.takeaways, [])
  })
})
