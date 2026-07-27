import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import CategoryBudgetItem from '#models/category_budget_item'
import CategoryMonthlyActual from '#models/category_monthly_actual'
import CategoryPayment from '#models/category_payment'
import RecurringBill from '#models/recurring_bill'
import UserSubscription from '#models/user_subscription'
import Utility from '#models/utility'
import CategoryTransformer from '#transformers/category_transformer'
import CategoryPaymentTransformer from '#transformers/category_payment_transformer'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'
import { upsertCategoryPaymentValidator } from '#validators/category_payment'

export default class CategoriesController {
  async index({ request, serialize }: HttpContext) {
    const query = Category.query().orderBy('sortOrder', 'asc')
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isPaused', false).andWhere('isArchived', false)
    }
    const categories = await query

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
    if (payload.isArchived) payload.isPaused = false
    category.merge(payload)
    await category.save()
    return serialize(CategoryTransformer.transform(category))
  }

  async destroy({ params, response }: HttpContext) {
    const category = await Category.findOrFail(params.id)
    if (!category.isArchived) {
      return response.conflict({ message: 'Only archived categories can be permanently removed' })
    }

    // Hard delete - SQLite FK enforcement is off in this app, so the
    // CASCADE/SET NULL behavior declared in migrations doesn't fire on its
    // own; clean up dependents explicitly instead of leaving orphans.
    await CategoryBudgetItem.query().where('categoryId', category.id).delete()
    await CategoryMonthlyActual.query().where('categoryId', category.id).delete()
    await RecurringBill.query().where('categoryId', category.id).update({ categoryId: null })
    await UserSubscription.query().where('categoryId', category.id).update({ categoryId: null })
    await Utility.query().where('categoryId', category.id).update({ categoryId: null })
    await CategoryPayment.query().where('categoryId', category.id).delete()
    await category.delete()

    return response.noContent()
  }

  async upsertPayment({ params, request, serialize }: HttpContext) {
    const categoryId = Number(params.id)
    await Category.findOrFail(categoryId)
    const payload = await request.validateUsing(upsertCategoryPaymentValidator)
    const year = Number(params.year)
    const month = Number(params.month)

    const payment = await CategoryPayment.updateOrCreate(
      { categoryId, year, month },
      { paid: payload.paid }
    )

    return serialize(CategoryPaymentTransformer.transform(payment))
  }
}
