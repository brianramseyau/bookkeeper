import type IncomeSource from '#models/income_source'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class IncomeSourceTransformer extends BaseTransformer<IncomeSource> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'userId',
      'name',
      'expectedAmount',
      'isActive',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
