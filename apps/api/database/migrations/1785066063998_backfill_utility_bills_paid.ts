import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Data-only follow-up to the `paid` column added to utility_bills earlier
 * today. Every existing bill predates the paid-tracking feature entirely,
 * so its `paid: false` is a schema default, not a real "unpaid" signal -
 * anything from before the current calendar month has, in reality, already
 * been paid. Bills in the current month are left alone (the checkbox is
 * there specifically to track those going forward).
 */
export default class extends BaseSchema {
  async up() {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth() + 1

    await this.db
      .from('utility_bills')
      .where((query) => {
        query
          .where('year', '<', year)
          .orWhere((q) => q.where('year', year).andWhere('month', '<', month))
      })
      .update({ paid: true })
  }

  async down() {
    // Irreversible data change - see class comment.
  }
}
