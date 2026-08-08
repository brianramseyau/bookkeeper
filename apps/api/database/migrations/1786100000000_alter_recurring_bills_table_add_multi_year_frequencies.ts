import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds `biennial` (every 2 years) and `triennial` (every 3 years)
 * frequencies, plus a `due_year` anchor - unlike the periods that already
 * existed (monthly/quarterly/biannual/annual, all of which divide evenly
 * into 12), a 24- or 36-month cycle can't be identified from `due_month`
 * alone since that only encodes a position within a single calendar year.
 * `due_year` anchors which year the cycle started on;
 * `recurring_bill_due_date.ts` folds it into the due-month check
 * generically, so existing bills (whose period already divides 12) behave
 * identically regardless of what `due_year` holds.
 *
 * `biennial` (every 2 years) and `biannual` (twice a year, i.e. every 6
 * months) are deliberately distinct enum values despite the easily-confused
 * names - the frontend labels them "Every 2 years" and "Biannual"
 * respectively to keep them visually distinct too.
 *
 * `disableTransactions` + the `PRAGMA foreign_keys` bracketing are load-
 * bearing, not decoration - widening the `frequency` CHECK constraint means
 * SQLite can't alter the column in place, so knex rebuilds the whole
 * `recurring_bills` table (create new, copy rows, drop old, rename). With
 * `foreign_keys = ON` (this app's default - see config/database.ts), that
 * DROP of the old `recurring_bills` table would cascade-delete every
 * `recurring_bill_payments` row referencing it (`ON DELETE CASCADE`) as a
 * side effect - see AGENTS.md's "SQLite table-rebuild migrations" section.
 *
 * `frequency` is widened via an add-copy-drop-rename dance rather than
 * `.enum(...).alter()` - knex's sqlite rebuild for `.alter()` on an enum
 * column keeps the *old* CHECK constraint alongside the new one instead of
 * replacing it (verified against a real dev DB - inserting 'triennial'
 * failed with `CHECK constraint failed: frequency` even after the "widened"
 * migration ran), silently making the widened enum unusable. A plain
 * `dropColumn('frequency')` followed by re-adding it would also silently
 * discard every existing bill's frequency (SQLite's column-drop rebuild
 * only carries over *surviving* columns' data, and a freshly re-added
 * column has no data to inherit) - copying into a new column and renaming
 * over the old one preserves existing values through the rebuild. The copy
 * itself runs via `this.defer(...)`, not a plain `await this.db...` call -
 * `this.schema.alterTable(...)` calls only queue up here and actually run
 * later, so a bare `await` would race ahead of the schema changes it
 * depends on (see `repoint_recurring_bills_category_id_fk_to_categories`
 * for the same pattern).
 */
export default class extends BaseSchema {
  protected tableName = 'recurring_bills'
  static disableTransactions = true

  async up() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.integer('due_year').nullable()
      table
        .enum('frequency_new', [
          'monthly',
          'quarterly',
          'biannual',
          'annual',
          'biennial',
          'triennial',
          'custom',
        ])
        .notNullable()
        .defaultTo('annual')
    })

    this.defer(async (db) => {
      await db.rawQuery('UPDATE recurring_bills SET frequency_new = frequency')
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('frequency')
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('frequency_new', 'frequency')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }

  async down() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('due_year')
      table
        .enum('frequency_old', ['monthly', 'quarterly', 'biannual', 'annual', 'custom'])
        .notNullable()
        .defaultTo('annual')
    })

    // Any 'biennial'/'triennial' bill can't survive the downgrade - the old
    // enum never supported them - so they're coerced to 'annual' rather than
    // failing outright.
    this.defer(async (db) => {
      await db.rawQuery(
        `UPDATE recurring_bills SET frequency_old = CASE WHEN frequency IN ('biennial', 'triennial') THEN 'annual' ELSE frequency END`
      )
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('frequency')
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.renameColumn('frequency_old', 'frequency')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }
}
