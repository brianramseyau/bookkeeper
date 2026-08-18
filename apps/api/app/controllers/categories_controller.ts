import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import CategoryTransformer from '#transformers/category_transformer'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'
import {
  flattenCategoriesTree,
  findUsableParent,
  assertNoChildren,
  setArchivedRecursively,
} from '#services/category_tree'

function errorMessage(error: unknown): string {
  // Every branch that reaches this helper throws a real `Error` from
  // category_tree.ts, so the string fallback can't actually fire (see README's
  // documented coverage exclusions).
  return error instanceof Error ? error.message : /* c8 ignore next */ 'Invalid selection'
}

export default class CategoriesController {
  async index({ request, serialize }: HttpContext) {
    const query = Category.query().orderBy('sortOrder', 'asc')
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isArchived', false)
    }
    const categories = await query

    return serialize(CategoryTransformer.transform(flattenCategoriesTree(categories)))
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createCategoryValidator)

    if (payload.parentId !== null && payload.parentId !== undefined) {
      try {
        await findUsableParent(payload.parentId)
      } catch (error) {
        return response.conflict({ message: errorMessage(error) })
      }
    }

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

    // One-level nesting: a parent must exist and be a top-level category, a
    // category can't be its own parent, and a category with children can't be
    // demoted to a child (no grandchildren).
    if (payload.parentId !== undefined && payload.parentId !== category.parentId) {
      if (payload.parentId !== null) {
        if (payload.parentId === category.id) {
          return response.conflict({ message: 'A category cannot be its own parent' })
        }
        try {
          await findUsableParent(payload.parentId)
          await assertNoChildren(category)
        } catch (error) {
          return response.conflict({ message: errorMessage(error) })
        }
      }
    }

    // Archiving/unarchiving applies to the whole subtree, so a parent never
    // hides while its children stay active (or vice versa). Applied before the
    // merge so it reflects the category's current parent.
    if (payload.isArchived !== undefined && payload.isArchived !== category.isArchived) {
      await setArchivedRecursively(category, payload.isArchived)
      delete payload.isArchived
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
    // categoryId cleared rather than being deleted themselves), and the
    // self-referential parent_id CASCADE FK deletes this category's children.
    await category.delete()

    return response.noContent()
  }
}
