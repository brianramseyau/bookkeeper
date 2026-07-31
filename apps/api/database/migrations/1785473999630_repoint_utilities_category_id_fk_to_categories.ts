import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `utilities.category_id` was declared `REFERENCES categories(id)` back
 * when `categories` meant the heavy tracking table - that table is now
 * `expenses` (see the rename migrations above), so the constraint has to
 * be dropped and recreated against the new lean `categories` table. Values
 * are nulled first since they currently point into the `expenses` id space
 * (some utilities carry an id from the old xlsx import) and wouldn't
 * satisfy the new constraint; `backfill_utilities_system_category` (next)
 * forces every row onto the system Utilities category regardless, so
 * there's nothing worth remapping here first.
 *
 * The null-out is wrapped in `defer()` (rather than a plain `this.db` call)
 * because `this.schema.alterTable(...)` calls are only *tracked* here and
 * actually execute later, in the order queued alongside `defer()`
 * callbacks - an un-deferred `this.db` query runs immediately instead,
 * before any schema changes below it have taken effect.
 *
 * `disableTransactions` + the `PRAGMA foreign_keys` bracketing are load-
 * bearing, not decoration: SQLite can't ALTER a foreign key constraint in
 * place, so `dropForeign`/`foreign` rebuild the whole `utilities` table
 * (create a new one, copy rows, drop the old one, rename). With
 * `foreign_keys = ON` (this app's default - see config/database.ts), that
 * DROP of the old `utilities` table cascade-deletes every `utility_bills`
 * row referencing it (its FK is `ON DELETE CASCADE`) as a side effect of
 * the rebuild - confirmed by reproducing it against a real data copy: 124
 * utility_bills rows silently became 0. SQLite also only lets
 * `PRAGMA foreign_keys` take effect *outside* an open transaction, which
 * is why this migration has to opt out of Adonis's default per-migration
 * transaction wrapping.
 */
export default class extends BaseSchema {
  protected tableName = 'utilities'
  static disableTransactions = true

  async up() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.defer(async (db) => {
      await db.from(this.tableName).update({ category_id: null })
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['category_id'])
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.foreign('category_id').references('id').inTable('categories').onDelete('SET NULL')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }

  async down() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['category_id'])
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.foreign('category_id').references('id').inTable('expenses').onDelete('SET NULL')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }
}
