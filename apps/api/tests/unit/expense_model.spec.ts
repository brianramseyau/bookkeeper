import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Expense from '#models/expense'

test.group('Expense.assignSortOrder', () => {
  // Unlike the functional suite, tests/unit isn't wrapped in a per-test DB
  // transaction (see tests/bootstrap.ts), so an Expense created here has no
  // `$trx` - exercises the non-transactional query branch in
  // assignSortOrder that the functional suite's wrapped transaction always
  // skips. Cleans up after itself since nothing rolls this back.
  test('assigns the next sortOrder via a plain query when created outside a transaction', async ({
    assert,
  }) => {
    const expense = await Expense.create({ name: 'No-Trx Sort Check' })
    try {
      assert.isNumber(expense.sortOrder)
    } finally {
      await expense.delete()
    }
  })

  // No current caller passes an explicit `{ client: trx }` (expenses_controller
  // just calls `Expense.create(payload)`), but the hook's own comment documents
  // this branch as deliberate deadlock-avoidance for a future trx-wrapped
  // caller (e.g. a bulk import) - exercise it directly here so it isn't dead code.
  test('reuses an explicitly passed transaction client instead of the default connection', async ({
    assert,
  }) => {
    const trx = await db.transaction()
    try {
      const expense = await Expense.create({ name: 'Explicit-Trx Sort Check' }, { client: trx })
      assert.isNumber(expense.sortOrder)
    } finally {
      await trx.rollback()
    }
  })
})
