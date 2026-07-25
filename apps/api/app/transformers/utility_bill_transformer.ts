import type UtilityBill from '#models/utility_bill'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UtilityBillTransformer extends BaseTransformer<UtilityBill> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'utilityId',
      'year',
      'month',
      'amount',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
