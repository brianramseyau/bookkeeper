import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Data-only follow-up to the income_sources cadence columns added in the
 * previous migration (kept separate since Lucid's schema builder defers
 * DDL until after `up()` returns, so a same-migration data query against a
 * just-added column fails with "no such column").
 *
 * Backfills the two real income sources with the cadence the household
 * described: Brian is paid monthly on the 14th (rolled back to the
 * preceding Friday on a weekend); Ariel is paid fortnightly on a Wednesday,
 * anchored on a confirmed real payday. A no-op for any other income source.
 *
 * Also wipes income_entries - the existing rows predate per-pay-period
 * tracking (one lump total per calendar month, no received_on dates at
 * all), so they're discarded per explicit instruction rather than guessing
 * a fake per-period split. Not reversible.
 */
export default class extends BaseSchema {
  async up() {
    await this.db
      .from('income_sources')
      .where('name', 'Brian Income')
      .update({ frequency: 'monthly', pay_day_of_month: 14, weekend_rollback: true })
    await this.db
      .from('income_sources')
      .where('name', 'Ariel Income')
      .update({ frequency: 'fortnightly', anchor_date: '2026-07-22' })

    await this.db.from('income_entries').delete()
  }

  async down() {
    // Irreversible data change - see class comment.
  }
}
