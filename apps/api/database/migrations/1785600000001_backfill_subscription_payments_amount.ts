import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Data-only follow-up to the `amount` column added to subscription_payments
 * moments ago. Every existing payment row predates per-month amount
 * tracking, so its actual has only ever been able to show the
 * subscription's *current* live amount - there's no record of what it
 * actually cost back then. That current amount (as of the moment this
 * migration runs) is the best information available for what already
 * happened, so backfilling it into every existing row's `amount` freezes
 * what's already on screen today rather than letting it keep drifting every
 * time the subscription's price changes again in future.
 *
 * Deliberately not scoped to "past months" - a row only exists here at all
 * because a payment was already recorded (paid ticked, or an amount
 * entered) before this migration ran, regardless of which month it's for,
 * so it's already-recorded history that should be locked down. Filtering
 * by month would leave whatever's already recorded for the in-progress
 * current month unprotected purely because of when in the month this
 * migration happens to deploy - a row that doesn't exist yet is simply left
 * alone and picks up its amount normally whenever it's created from here on.
 */
export default class extends BaseSchema {
  async up() {
    const rows = await this.db
      .from('subscription_payments as p')
      .join('user_subscriptions as s', 's.id', 'p.user_subscription_id')
      .whereNull('p.amount')
      .select('p.id', 's.amount as subscriptionAmount')

    for (const row of rows) {
      await this.db
        .from('subscription_payments')
        .where('id', row.id)
        .update({ amount: row.subscriptionAmount })
    }
  }

  async down() {
    // Irreversible data change - see class comment.
  }
}
