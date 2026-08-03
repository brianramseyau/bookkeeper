import type SubscriptionPayment from '#models/subscription_payment'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class SubscriptionPaymentTransformer extends BaseTransformer<SubscriptionPayment> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'userSubscriptionId',
      'year',
      'month',
      'paid',
      'amount',
      'createdAt',
      'updatedAt',
    ])
  }
}
