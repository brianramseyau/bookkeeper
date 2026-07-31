import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import CategoryTransformer from '#transformers/category_transformer'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'

export default class CategoriesController {
  async index({ request, serialize }: HttpContext) {
    const query = Category.query().orderBy('sortOrder', 'asc')
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isArchived', false)
    }
    const categories = await query

    return serialize(CategoryTransformer.transform(categories))
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createCategoryValidator)
    const category = await Category.create(payload)
    return response.created(await serialize(CategoryTransformer.transform(category)))
  }

  async update({ params, request, response, serialize }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    const payload = await request.validateUsing(updateCategoryValidator)

    // The system category (currently just "Utilities") is hard-coded to by
    // Utilities and must stay a stable, recognizable tag - renaming or
    // archiving it out from under that assumption isn't allowed. Color and
    // sortOrder are cosmetic and stay editable.
    if (category.isSystem) {
      const renaming = payload.name !== undefined && payload.name !== category.name
      if (renaming || payload.isArchived === true) {
        return response.conflict({ message: 'The system category cannot be renamed or archived' })
      }
    }

    category.merge(payload)
    await category.save()
    return serialize(CategoryTransformer.transform(category))
  }

  async destroy({ params, response }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    if (category.isSystem) {
      return response.conflict({ message: 'The system category cannot be removed' })
    }
    if (!category.isArchived) {
      return response.conflict({ message: 'Only archived categories can be permanently removed' })
    }

    // Hard delete - the DB's SET NULL FKs handle dependents (expenses,
    // utilities, recurring_bills, user_subscriptions all have their
    // categoryId cleared rather than being deleted themselves).
    await category.delete()

    return response.noContent()
  }
}
