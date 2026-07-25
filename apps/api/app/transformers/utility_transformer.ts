import type Utility from '#models/utility'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UtilityTransformer extends BaseTransformer<Utility> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'name',
      'categoryId',
      'isActive',
      'createdAt',
      'updatedAt',
    ])
  }
}
