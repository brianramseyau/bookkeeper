import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import CategoryTransformer from '#transformers/category_transformer'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'

export default class CategoriesController {
  async index({ serialize }: HttpContext) {
    const categories = await Category.query().where('isActive', true).orderBy('sortOrder', 'asc')
    return serialize(CategoryTransformer.transform(categories))
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createCategoryValidator)
    const category = await Category.create(payload)
    return response.created(await serialize(CategoryTransformer.transform(category)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    const payload = await request.validateUsing(updateCategoryValidator)
    category.merge(payload)
    await category.save()
    return serialize(CategoryTransformer.transform(category))
  }

  async destroy({ params, response }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    category.isActive = false
    await category.save()
    return response.noContent()
  }
}
