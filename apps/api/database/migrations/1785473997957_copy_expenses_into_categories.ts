import { BaseSchema } from '@adonisjs/lucid/schema'
import { DateTime } from 'luxon'

/**
 * Data-only migration: populates the new lean `categories` table from the
 * rows that used to live there before the previous migrations renamed that
 * table to `expenses` - preserving every existing name/color/sortOrder as
 * a fresh Category tag, and flagging the "Utilities" one as the protected
 * system category that Utilities will be hard-coded to (see
 * `backfill_utilities_system_category`). The actual `recurring_bills`/
 * `user_subscriptions` tag remap happens in the FK-repoint migrations
 * below, resolved there by matching `expenses.name` to `categories.name`
 * (rather than here, since those migrations run after this one and can't
 * share this migration's in-memory id map).
 */
export default class extends BaseSchema {
  async up() {
    const now = DateTime.utc().toSQL()
    const expenses = await this.db
      .from('expenses')
      .select('name', 'color', 'sort_order', 'is_active', 'is_archived')

    let sawUtilities = false

    for (const expense of expenses) {
      const isUtilities = expense.name === 'Utilities'
      if (isUtilities) sawUtilities = true

      await this.db.table('categories').insert({
        name: expense.name,
        color: expense.color,
        sort_order: expense.sort_order,
        is_active: expense.is_active,
        is_archived: expense.is_archived,
        is_system: isUtilities,
        created_at: now,
        updated_at: now,
      })
    }

    if (!sawUtilities) {
      await this.db.table('categories').insert({
        name: 'Utilities',
        is_system: true,
        created_at: now,
        updated_at: now,
      })
    }
  }

  async down() {
    // Irreversible data change - see class comment on data-only migrations
    // elsewhere in this repo (e.g. `renumber_category_sort_orders`).
  }
}
