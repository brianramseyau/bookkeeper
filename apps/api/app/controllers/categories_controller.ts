import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import CategoryTransformer from '#transformers/category_transformer'

/**
 * Read-only for now (Phase 2 just needs a list to populate dropdowns).
 * Phase 4 adds store/update/destroy here for full category management.
 */
export default class CategoriesController {
  async index({ serialize }: HttpContext) {
    const categories = await Category.query().where('isActive', true).orderBy('sortOrder', 'asc')
    return serialize(CategoryTransformer.transform(categories))
  }
}
