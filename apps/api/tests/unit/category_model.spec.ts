import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'

test.group('Category.assignSortOrder', () => {
  // Unlike the functional suite, tests/unit isn't wrapped in a per-test DB
  // transaction (see tests/bootstrap.ts), so a Category created here has no
  // `$trx` - exercises the non-transactional query branch in
  // assignSortOrder that the functional suite's wrapped transaction always
  // skips. Cleans up after itself since nothing rolls this back.
  test('assigns the next sortOrder via a plain query when created outside a transaction', async ({
    assert,
  }) => {
    const category = await Category.create({ name: 'No-Trx Sort Check' })
    try {
      assert.isNumber(category.sortOrder)
    } finally {
      await category.delete()
    }
  })

  // No current caller passes an explicit `{ client: trx }` (categories_controller
  // just calls `Category.create(payload)`), but the hook's own comment documents
  // this branch as deliberate deadlock-avoidance for a future trx-wrapped
  // caller (e.g. a bulk import) - exercise it directly here so it isn't dead code.
  test('reuses an explicitly passed transaction client instead of the default connection', async ({
    assert,
  }) => {
    const trx = await db.transaction()
    try {
      const category = await Category.create({ name: 'Explicit-Trx Sort Check' }, { client: trx })
      assert.isNumber(category.sortOrder)
    } finally {
      await trx.rollback()
    }
  })
})
