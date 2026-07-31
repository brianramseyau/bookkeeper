import { BaseSchema } from '@adonisjs/lucid/schema'
import { DateTime } from 'luxon'

/**
 * Data-only follow-up to the `received_on` column added to utility_bills
 * moments ago. Every existing bill predates received-date tracking, so
 * `received_on` is null purely because the feature didn't exist yet - not
 * because the date is genuinely unknown. Due dates used to be computed as a
 * fixed day-of-month (`due_offset_days`, clamped into the billing month)
 * rather than an offset from a received date, so that old day-of-month
 * figure *is* the historical due date - working backwards from it
 * (due date minus the offset) reconstructs a reasonable received date for
 * bills whose utility has an offset configured. Utilities with no offset
 * never had a computable due date either, so there's nothing to back into.
 */
export default class extends BaseSchema {
  async up() {
    const rows = await this.db
      .from('utility_bills as b')
      .join('utilities as u', 'u.id', 'b.utility_id')
      .whereNotNull('u.due_offset_days')
      .select('b.id', 'b.year', 'b.month', 'u.due_offset_days as dueOffsetDays')

    for (const row of rows) {
      const daysInMonth = DateTime.utc(row.year, row.month, 1).daysInMonth ?? 31
      const day = Math.min(Math.max(row.dueOffsetDays, 1), daysInMonth)
      const oldDueDate = DateTime.utc(row.year, row.month, day)
      const receivedOn = oldDueDate.minus({ days: row.dueOffsetDays })

      await this.db
        .from('utility_bills')
        .where('id', row.id)
        .update({ received_on: receivedOn.toISODate() })
    }
  }

  async down() {
    // Irreversible data change - see class comment.
  }
}
