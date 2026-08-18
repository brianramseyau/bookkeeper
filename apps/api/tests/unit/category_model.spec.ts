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

  test("scopes the next sortOrder to the category's parent group", async ({ assert }) => {
    const parent = await Category.create({ name: 'Sort Scope Parent' })
    try {
      const child1 = await Category.create({ name: 'Sort Scope Child 1', parentId: parent.id })
      const child2 = await Category.create({ name: 'Sort Scope Child 2', parentId: parent.id })
      try {
        // Children start their own sequence at 0 regardless of the global max.
        assert.equal(child1.sortOrder, 0)
        assert.equal(child2.sortOrder, 1)
      } finally {
        await child2.delete()
        await child1.delete()
      }
    } finally {
      await parent.delete()
    }
  })

  test("continues the top-level sequence, not the parent's child sequence", async ({ assert }) => {
    const parent = await Category.create({ name: 'Seq Parent' })
    const child = await Category.create({ name: 'Seq Child', parentId: parent.id })
    try {
      // A top-level category created while a parent + children exist keeps
      // counting the top-level sequence rather than restarting at 0.
      const topLevel = await Category.create({ name: 'Seq Top Level' })
      try {
        assert.isTrue(topLevel.sortOrder > parent.sortOrder)
        assert.isTrue(topLevel.sortOrder !== child.sortOrder)
      } finally {
        await topLevel.delete()
      }
    } finally {
      await child.delete()
      await parent.delete()
    }
  })
})
