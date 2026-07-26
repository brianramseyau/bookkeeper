import type UserSubscription from '#models/user_subscription'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UserSubscriptionTransformer extends BaseTransformer<UserSubscription> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'userId',
      'name',
      'categoryId',
      'amount',
      'dayOfMonth',
      'includeInStandardMonth',
      'isActive',
      'isPaused',
      'isArchived',
      'notes',
      'createdAt',
      'updatedAt',
    ])
  }
}
