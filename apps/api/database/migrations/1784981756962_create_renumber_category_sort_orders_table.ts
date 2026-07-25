import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Categories created before the Category model started auto-assigning
 * sortOrder (see app/models/category.ts) all silently share the column's
 * DB default of 0, which makes the reorder UI a no-op for any of them.
 * Renumber every existing row sequentially, preserving current display
 * order (sort_order asc, id asc as the tie-break), so reordering works
 * for previously-created categories too.
 */
export default class extends BaseSchema {
  async up() {
    const rows = await this.db
      .from('categories')
      .select('id')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
    for (const [index, row] of rows.entries()) {
      await this.db.from('categories').where('id', row.id).update({ sort_order: index })
    }
  }

  async down() {
    // Not reversible - the original (mostly duplicate) sort_order values aren't recoverable.
  }
}
