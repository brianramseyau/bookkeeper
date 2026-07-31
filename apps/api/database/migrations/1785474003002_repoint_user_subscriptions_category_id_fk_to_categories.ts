import { BaseSchema } from '@adonisjs/lucid/schema'

interface RemapRow {
  subscriptionId: number
  newCategoryId: number
}

/**
 * See `repoint_recurring_bills_category_id_fk_to_categories` - same
 * resolve-by-name-then-repoint-then-write-back approach (and the same
 * reason for using `defer()`), since existing tag assignments here are
 * real too (every subscription was importer-tagged with the old
 * "Subscriptions" category).
 *
 * `disableTransactions` + the `PRAGMA foreign_keys` bracketing are load-
 * bearing for the same reason as the utilities/recurring_bills repoints:
 * rebuilding this table would otherwise cascade-delete every
 * `subscription_payments` row referencing it (`ON DELETE CASCADE`), and
 * `PRAGMA foreign_keys` only takes effect outside an open transaction.
 */
export default class extends BaseSchema {
  protected tableName = 'user_subscriptions'
  static disableTransactions = true

  async up() {
    this.schema.raw('PRAGMA foreign_keys = OFF')

    let remap: RemapRow[] = []

    this.defer(async (db) => {
      remap = await db
        .from('user_subscriptions as us')
        .join('expenses as e', 'us.category_id', 'e.id')
        .join('categories as c', 'c.name', 'e.name')
        .select('us.id as subscriptionId', 'c.id as newCategoryId')

      await db.from(this.tableName).update({ category_id: null })
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropForeign(['category_id'])
    })
    this.schema.alterTable(this.tableName, (table) => {
      table.foreign('category_id').references('id').inTable('categories').onDelete('SET NULL')
    })

    this.defer(async (db) => {
      for (const { subscriptionId, newCategoryId } of remap) {
        await db
          .from(this.tableName)
          .where('id', subscriptionId)
          .update({ category_id: newCategoryId })
      }
    })

    this.schema.raw('PRAGMA foreign_keys = ON')
  }

  async down() {
    // See the matching comment in
    // `repoint_recurring_bills_category_id_fk_to_categories#down` - values
    // point into the `categories` id space by now and can't be
    // un-resolved back to `expenses` ids.
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
