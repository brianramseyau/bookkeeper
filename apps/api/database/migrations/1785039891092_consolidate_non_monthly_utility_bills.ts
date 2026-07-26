import { BaseSchema } from '@adonisjs/lucid/schema'

interface BillRow {
  id: number
  year: number
  month: number
  amount: string | number
  notes: string | null
}

const PERIOD_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
}

/**
 * Utility bills used to be entered once per calendar month regardless of how
 * often a utility is actually billed, so a quarterly bill (e.g. Water) had
 * to be manually divided by 3 and logged as three identical monthly rows.
 * Utilities are now entered by their real billing frequency instead, so
 * this collapses each utility's existing bills into one row per real
 * billing period: consecutive calendar months are grouped into runs of
 * `periodMonths`, each run summed into its last month's row (the actual
 * bill date), with the other rows in the run deleted.
 *
 * Not reversible - the original per-month split amounts aren't recoverable
 * once summed. Restore from a pre-migration backup if this ever needs
 * undoing.
 */
export default class extends BaseSchema {
  async up() {
    const utilities = await this.db.from('utilities').select('id', 'frequency')

    for (const utility of utilities) {
      const periodMonths = PERIOD_MONTHS[utility.frequency] ?? 1
      if (periodMonths <= 1) continue

      const bills: BillRow[] = await this.db
        .from('utility_bills')
        .where('utility_id', utility.id)
        .orderBy('year', 'asc')
        .orderBy('month', 'asc')

      let run: BillRow[] = []

      const flush = async () => {
        if (run.length === 0) return
        const last = run[run.length - 1]!
        const total = run.reduce((sum, bill) => sum + Number(bill.amount), 0)
        const notes = [...new Set(run.map((bill) => bill.notes?.trim()).filter(Boolean))].join('; ')

        // Leaves `updated_at` untouched - Lucid stores it as a formatted SQL
        // datetime string, and a raw JS Date here would corrupt that format
        // (better-sqlite3 stores it as a plain integer instead).
        await this.db
          .from('utility_bills')
          .where('id', last.id)
          .update({
            amount: Math.round(total * 100) / 100,
            notes: notes === '' ? null : notes,
          })

        const idsToDelete = run.slice(0, -1).map((bill) => bill.id)
        if (idsToDelete.length > 0) {
          await this.db.from('utility_bills').whereIn('id', idsToDelete).delete()
        }
        run = []
      }

      for (const bill of bills) {
        const previous = run[run.length - 1]
        const contiguous =
          previous !== undefined &&
          bill.year * 12 + bill.month === previous.year * 12 + previous.month + 1
        if (run.length > 0 && !contiguous) {
          await flush()
        }
        run.push(bill)
        if (run.length === periodMonths) {
          await flush()
        }
      }
      await flush()
    }
  }

  async down() {
    // Irreversible data consolidation - see class comment.
  }
}
