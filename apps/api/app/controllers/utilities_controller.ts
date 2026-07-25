import type { HttpContext } from '@adonisjs/core/http'
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
    const utility = await Utility.create(payload)
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
