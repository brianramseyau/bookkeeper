import { BaseSchema } from '@adonisjs/lucid/schema'
import { DateTime } from 'luxon'

/**
 * Reverts the data written by `1785483119667_backfill_utility_bills_received_on`.
 * That migration reconstructed a `received_on` for every pre-existing bill as
 * `oldDueDate.minus({ days: dueOffsetDays })`, where `oldDueDate`'s
 * day-of-month is itself `dueOffsetDays` - an identity that always resolves
 * to the last day of the *previous* month, no matter the offset. It wasn't a
 * real received date, just an artifact of the old fixed-day-of-month system.
 *
 * Those synthetic dates are harmless for redisplaying a bill's own past due
 * date (the identity round-trips), but `typicalReceivedDayOfMonth` also
 * averages `received_on` across every bill to estimate when a not-yet-billed
 * month's bill will arrive - and dozens of month-end placeholders skew that
 * average weeks later than utilities actually arrive, which is why
 * forecasted due dates for utilities without a current-month bill on record
 * (Electricity, Gas, Water) were showing weeks past reality while ones with
 * a real current-month bill already entered (Internet) were unaffected.
 * Nulling the synthetic rows back out removes the skew; a null received_on
 * for an already-billed past month just means its own due date can no longer
 * be redisplayed, same as if received-date tracking had never backfilled it.
 */
export default class extends BaseSchema {
  async up() {
    const rows = await this.db
      .from('utility_bills as b')
      .join('utilities as u', 'u.id', 'b.utility_id')
      .whereNotNull('u.due_offset_days')
      .whereNotNull('b.received_on')
      .select(
        'b.id',
        'b.year',
        'b.month',
        'b.received_on as receivedOn',
        'u.due_offset_days as dueOffsetDays'
      )

    for (const row of rows) {
      const daysInMonth = DateTime.utc(row.year, row.month, 1).daysInMonth ?? 31
      const day = Math.min(Math.max(row.dueOffsetDays, 1), daysInMonth)
      const oldDueDate = DateTime.utc(row.year, row.month, day)
      const reconstructed = oldDueDate.minus({ days: row.dueOffsetDays }).toISODate()

      if (DateTime.fromSQL(String(row.receivedOn)).toISODate() === reconstructed) {
        await this.db.from('utility_bills').where('id', row.id).update({ received_on: null })
      }
    }
  }

  async down() {
    // Data-only correction, and the value being corrected was itself
    // synthetic - nothing genuine to restore.
  }
}
