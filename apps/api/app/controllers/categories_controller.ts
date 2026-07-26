import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import CategoryBudgetItem from '#models/category_budget_item'
import CategoryTransformer from '#transformers/category_transformer'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'

export default class CategoriesController {
  async index({ serialize }: HttpContext) {
    const categories = await Category.query().where('isActive', true).orderBy('sortOrder', 'asc')

    const items = await CategoryBudgetItem.query().whereIn(
      'categoryId',
      categories.map((category) => category.id)
    )
    const budgetItemCounts = new Map<number, number>()
    for (const item of items) {
      budgetItemCounts.set(item.categoryId, (budgetItemCounts.get(item.categoryId) ?? 0) + 1)
    }

    const serialized = await serialize.withoutWrapping(CategoryTransformer.transform(categories))
    const results = serialized.map((item, index) => ({
      ...item,
      budgetItemCount: budgetItemCounts.get(categories[index]!.id) ?? 0,
    }))

    return { data: results }
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
