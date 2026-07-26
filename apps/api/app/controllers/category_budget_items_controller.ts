import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import CategoryBudgetItem from '#models/category_budget_item'
import CategoryBudgetItemTransformer from '#transformers/category_budget_item_transformer'
import {
  createCategoryBudgetItemValidator,
  updateCategoryBudgetItemValidator,
} from '#validators/category_budget_item'

export default class CategoryBudgetItemsController {
  async index({ params, serialize }: HttpContext) {
    const categoryId = Number(params.id)
    await Category.findOrFail(categoryId)

    const items = await CategoryBudgetItem.query()
      .where('categoryId', categoryId)
      .orderBy('name', 'asc')

    return serialize(CategoryBudgetItemTransformer.transform(items))
  }

  async store({ params, request, response, serialize }: HttpContext) {
    const categoryId = Number(params.id)
    await Category.findOrFail(categoryId)
    const payload = await request.validateUsing(createCategoryBudgetItemValidator)

    const item = await CategoryBudgetItem.create({
      categoryId,
      name: payload.name,
      amount: payload.amount,
      notes: payload.notes ?? null,
    })
    await this.syncCategoryBudget(categoryId)

    return response.created(await serialize(CategoryBudgetItemTransformer.transform(item)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const item = await CategoryBudgetItem.findOrFail(params.id)
    const payload = await request.validateUsing(updateCategoryBudgetItemValidator)
    item.merge(payload)
    await item.save()
    await this.syncCategoryBudget(item.categoryId)

    return serialize(CategoryBudgetItemTransformer.transform(item))
  }

  async destroy({ params, response }: HttpContext) {
    const item = await CategoryBudgetItem.findOrFail(params.id)
    const categoryId = item.categoryId
    await item.delete()
    await this.syncCategoryBudget(categoryId)

    return response.noContent()
  }

  /**
   * Once a category has any itemized budget lines, its budgetAmount is a
   * derived total rather than a free-standing manual figure - keep it in
   * sync with the items, and clear it back to null (fall back to the
   * rolling average) if the last item is removed.
   */
  private async syncCategoryBudget(categoryId: number) {
    const items = await CategoryBudgetItem.query().where('categoryId', categoryId)
    const category = await Category.findOrFail(categoryId)
    category.budgetAmount =
      items.length > 0
        ? Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100
        : null
    await category.save()
  }
}
