import { test } from '@japa/runner'
import ExcelJS from 'exceljs'
import { parseRecurringBillsSheet } from '#services/import/parse_recurring_bills_sheet'

function buildSheet() {
  const workbook = new ExcelJS.Workbook()
  return workbook.addWorksheet('Annual')
}

test.group('parseRecurringBillsSheet', () => {
  test('parses name, amount, day/month, year and next due date', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(2)
    row.getCell(1).value = 'Costco Membership'
    row.getCell(2).value = 65
    row.getCell(3).value = new Date(Date.UTC(2025, 0, 31))
    row.getCell(4).value = undefined
    row.getCell(5).value = new Date(Date.UTC(2026, 0, 31))

    const rows = parseRecurringBillsSheet(sheet)

    assert.deepEqual(rows, [
      {
        name: 'Costco Membership',
        amount: 65,
        dueDay: 31,
        dueMonth: 1,
        dueYear: null,
        nextDueOn: '2026-01-31',
      },
    ])
  })

  test('reads day/month and next date from formula-cell cached results', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(2)
    row.getCell(1).value = 'VPN'
    row.getCell(2).value = { formula: 'B1', result: 39.99 } as unknown as number
    row.getCell(3).value = {
      formula: 'C1',
      result: new Date(Date.UTC(2025, 5, 15)),
    } as unknown as Date
    row.getCell(4).value = 2027
    row.getCell(5).value = {
      formula: 'E1',
      result: new Date(Date.UTC(2027, 5, 15)),
    } as unknown as Date

    const rows = parseRecurringBillsSheet(sheet)

    assert.deepEqual(rows, [
      {
        name: 'VPN',
        amount: 39.99,
        dueDay: 15,
        dueMonth: 6,
        dueYear: 2027,
        nextDueOn: '2027-06-15',
      },
    ])
  })

  test('defaults amount to 0 when the amount cell is not numeric', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(2)
    row.getCell(1).value = 'Free Trial'
    row.getCell(3).value = new Date(Date.UTC(2025, 2, 1))

    const rows = parseRecurringBillsSheet(sheet)

    assert.equal(rows[0].amount, 0)
  })

  test('leaves nextDueOn null when the sheet has no Next value', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(2)
    row.getCell(1).value = 'Council Rates'
    row.getCell(2).value = 2689.3
    row.getCell(3).value = new Date(Date.UTC(2025, 1, 15))

    const rows = parseRecurringBillsSheet(sheet)

    assert.isNull(rows[0].nextDueOn)
  })

  test('stops at the first row with no parseable Day/Month date', ({ assert }) => {
    const sheet = buildSheet()
    const first = sheet.getRow(2)
    first.getCell(1).value = 'Costco Membership'
    first.getCell(2).value = 65
    first.getCell(3).value = new Date(Date.UTC(2025, 0, 31))

    const summary = sheet.getRow(3)
    summary.getCell(1).value = 'Total'
    summary.getCell(2).value = 65

    const another = sheet.getRow(4)
    another.getCell(1).value = 'Should not be reached'
    another.getCell(2).value = 10
    another.getCell(3).value = new Date(Date.UTC(2025, 0, 1))

    const rows = parseRecurringBillsSheet(sheet)

    assert.lengthOf(rows, 1)
    assert.equal(rows[0].name, 'Costco Membership')
  })

  test('treats a formula cell with a non-numeric/non-date cached result as blank/null', ({
    assert,
  }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(2)
    row.getCell(1).value = 'Weird'
    row.getCell(2).value = { formula: 'B1', result: '#N/A' } as unknown as number
    row.getCell(3).value = new Date(Date.UTC(2025, 0, 1))
    row.getCell(5).value = { formula: 'E1', result: 'not-a-date' } as unknown as Date

    const rows = parseRecurringBillsSheet(sheet)

    assert.equal(rows[0].amount, 0)
    assert.isNull(rows[0].nextDueOn)
  })

  test('stops at the first row with a blank name', ({ assert }) => {
    const sheet = buildSheet()
    const row = sheet.getRow(2)
    row.getCell(3).value = new Date(Date.UTC(2025, 0, 1))

    const rows = parseRecurringBillsSheet(sheet)

    assert.deepEqual(rows, [])
  })
})
