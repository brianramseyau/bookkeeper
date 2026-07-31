import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Utilities are hard-coded to the protected "Utilities" category from here
 * on (see UtilitiesController#store) - not user-selectable. Force every
 * existing utility row onto that category's id, regardless of whatever
 * (always-null in practice) value it had before.
 */
export default class extends BaseSchema {
  async up() {
    const utilitiesCategory = await this.db
      .from('categories')
      .where('name', 'Utilities')
      .andWhere('is_system', true)
      .first()

    await this.db.from('utilities').update({ category_id: utilitiesCategory.id })
  }

  async down() {
    await this.db.from('utilities').update({ category_id: null })
  }
}
