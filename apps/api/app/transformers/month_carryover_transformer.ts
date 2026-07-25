import type MonthCarryover from '#models/month_carryover'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class MonthCarryoverTransformer extends BaseTransformer<MonthCarryover> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'year',
      'month',
      'amount',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
