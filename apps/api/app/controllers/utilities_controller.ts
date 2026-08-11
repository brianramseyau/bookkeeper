import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'
import Utility from '#models/utility'
import UtilityTransformer from '#transformers/utility_transformer'
import { createUtilityValidator, updateUtilityValidator } from '#validators/utility'

export default class UtilitiesController {
  async index({ serialize }: HttpContext) {
    const utilities = await Utility.query().orderBy('name', 'asc')
    return serialize(UtilityTransformer.transform(utilities))
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createUtilityValidator)
    // Utilities are always tagged with the protected "Utilities" system
    // category, not user-selectable - see CategoriesController#update/
    // #destroy for how that category is protected from rename/archive.
    const utilitiesCategory = await Category.query()
      .where('name', 'Utilities')
      .andWhere('isSystem', true)
      .firstOrFail()
    // The DB column default isn't read back onto the in-memory instance
    // returned by `create`, so `paidInAdvance`/`dueOffsetBusinessDaysOnly`
    // the client never sent must still resolve to an explicit `false` here
    // rather than staying `undefined` in the response - same reasoning as
    // the `paid` default on UtilityBillsController#upsert.
    const utility = await Utility.create({
      ...payload,
      categoryId: utilitiesCategory.id,
      paidInAdvance: payload.paidInAdvance ?? false,
      dueOffsetBusinessDaysOnly: payload.dueOffsetBusinessDaysOnly ?? false,
    })
    return response.created(await serialize(UtilityTransformer.transform(utility)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const utility = await Utility.findOrFail(params.id)
    const payload = await request.validateUsing(updateUtilityValidator)
    utility.merge(payload)
    await utility.save()
    return serialize(UtilityTransformer.transform(utility))
  }

  async destroy({ params, response }: HttpContext) {
    const utility = await Utility.findOrFail(params.id)
    utility.isActive = false
    await utility.save()
    return response.noContent()
  }
}
