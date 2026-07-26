import { SubscriptionPaymentSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import UserSubscription from '#models/user_subscription'

export default class SubscriptionPayment extends SubscriptionPaymentSchema {
  @belongsTo(() => UserSubscription)
  declare userSubscription: BelongsTo<typeof UserSubscription>
}
