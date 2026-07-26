import { test } from '@japa/runner'
import ExcelJS from 'exceljs'
import { parseUsersSheet } from '#services/import/parse_users_sheet'

function buildSheet() {
  const workbook = new ExcelJS.Workbook()
  return workbook.addWorksheet('Users')
}

test.group('parseUsersSheet', () => {
  test('parses name, email and password rows', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).values = ['Name', 'Email', 'Password']
    sheet.getRow(2).values = ['Brian', 'brian@example.com', 'hunter2']
    sheet.getRow(3).values = ['Ariel', 'ariel@example.com', 'correct-horse']

    const rows = parseUsersSheet(sheet)

    assert.deepEqual(rows, [
      { fullName: 'Brian', email: 'brian@example.com', password: 'hunter2' },
      { fullName: 'Ariel', email: 'ariel@example.com', password: 'correct-horse' },
    ])
  })

  test('reads the email from a mailto: hyperlink cell', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).values = ['Name', 'Email', 'Password']
    const row = sheet.getRow(2)
    row.getCell(1).value = 'Brian'
    row.getCell(2).value = { text: 'brian@example.com', hyperlink: 'mailto:brian@example.com' }
    row.getCell(3).value = 'hunter2'

    const rows = parseUsersSheet(sheet)

    assert.equal(rows[0].email, 'brian@example.com')
  })

  test('stops at the first row missing a name, email, or password', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).values = ['Name', 'Email', 'Password']
    sheet.getRow(2).values = ['Brian', 'brian@example.com', 'hunter2']
    sheet.getRow(3).values = ['Ariel', 'ariel@example.com']
    sheet.getRow(4).values = ['Should not be reached', 'nope@example.com', 'nope']

    const rows = parseUsersSheet(sheet)

    assert.lengthOf(rows, 1)
    assert.equal(rows[0].fullName, 'Brian')
  })

  test('returns an empty array for a sheet with no data rows', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).values = ['Name', 'Email', 'Password']

    const rows = parseUsersSheet(sheet)

    assert.deepEqual(rows, [])
  })

  test('treats a whitespace-only name cell as blank', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).values = ['Name', 'Email', 'Password']
    sheet.getRow(2).values = ['   ', 'brian@example.com', 'hunter2']

    const rows = parseUsersSheet(sheet)

    assert.deepEqual(rows, [])
  })

  test('treats a hyperlink cell with whitespace-only text as blank', ({ assert }) => {
    const sheet = buildSheet()
    sheet.getRow(1).values = ['Name', 'Email', 'Password']
    const row = sheet.getRow(2)
    row.getCell(1).value = 'Brian'
    row.getCell(2).value = { text: '  ', hyperlink: 'mailto:' }
    row.getCell(3).value = 'hunter2'

    const rows = parseUsersSheet(sheet)

    assert.deepEqual(rows, [])
  })
})
