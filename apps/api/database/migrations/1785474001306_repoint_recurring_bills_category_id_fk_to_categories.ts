import { BaseSchema } from '@adonisjs/lucid/schema'

interface RemapRow {
  billId: number
  newCategoryId: number
}

/**
 * See `repoint_utilities_category_id_fk_to_categories` for why this needs
 * repointing, and why the data operations below are wrapped in `defer()`
 * rather than run as plain `this.db` calls - that's what keeps them
 * ordered correctly relative to the `this.schema.alterTable(...)` calls,
 * which only queue up here and actually execute later.
 *
 * Unlike Utilities, existing tag assignments here are real (importer-
 * assigned, but meaningful) and worth preserving: before nulling the
 * column to satisfy the new constraint, this resolves each row's old
 * `expenses` id to the matching new `categories` id by name (both tables
 * carry the same names at this point in the migration sequence - see
 * `copy_expenses_into_categories`), then writes the resolved value back
 * once the FK points at `categories`.
 *
 * `disableTransactions` + the `PRAGMA foreign_keys` bracketing are load-
 * bearing for the same reason as `repoint_utilities_category_id_fk_to_categories`:
 * rebuilding this table (SQLite can't ALTER a foreign key constraint in
 * place) would otherwise cascade-delete every `recurring_bill_payments`
 * row referencing it (`ON DELETE CASCADE`) as a side effect, and
 * `PRAGMA foreign_keys` only takes effect outside an open transaction.
 */
export default class extends BaseSchema {
  protected tableName = 'recurring_bills'
  static disableTransactions = true

  async up() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    let remap: RemapRow[] = []

    this.defer(async (db) => {
      remap = await db
        .from('recurring_bills as rb')
        .join('expenses as e', 'rb.category_id', 'e.id')
        .join('categories as c', 'c.name', 'e.name')
        .select('rb.id as billId', 'c.id as newCategoryId')

      await db.from(this.tableName).update({ category_id: null })
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['category_id'])
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.foreign('category_id').references('id').inTable('categories').onDelete('SET NULL')
    })

    this.defer(async (db) => {
      for (const { billId, newCategoryId } of remap) {
        await db.from(this.tableName).where('id', billId).update({ category_id: newCategoryId })
      }
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }

  async down() {
    // Values point into the `categories` id space by now (possibly
    // remapped further by later migrations too) - genuinely can't be
    // un-resolved back to `expenses` ids, so this nulls rather than
    // leaving a dangling/wrong reference once the FK repoints back.
    this.schema.raw('PRAGMA foreign_keys = OFF')

    this.defer(async (db) => {
      await db.from(this.tableName).update({ category_id: null })
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['category_id'])
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.foreign('category_id').references('id').inTable('expenses').onDelete('SET NULL')
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }
}
