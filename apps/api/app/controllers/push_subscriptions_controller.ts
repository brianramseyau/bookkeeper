import type { HttpContext } from '@adonisjs/core/http'
import PushSubscription from '#models/push_subscription'
import PushSubscriptionTransformer from '#transformers/push_subscription_transformer'
import { createPushSubscriptionValidator } from '#validators/push_subscription'
import { getPushPublicKey, sendTestNotification } from '#services/push_service'

export default class PushSubscriptionsController {
  async index({ auth, serialize }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const subscriptions = await PushSubscription.query()
      .where('userId', currentUser.id)
      .orderBy('createdAt', 'desc')
    return serialize(PushSubscriptionTransformer.transform(subscriptions))
  }

  async store({ auth, request, serialize }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const payload = await request.validateUsing(createPushSubscriptionValidator)

    const subscription = await PushSubscription.updateOrCreate(
      { endpoint: payload.endpoint },
      {
        userId: currentUser.id,
        p256Dh: payload.keys.p256dh,
        auth: payload.keys.auth,
        userAgent: request.header('user-agent') ?? null,
      }
    )

    return serialize(PushSubscriptionTransformer.transform(subscription))
  }

  async destroy({ auth, params, response }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const subscription = await PushSubscription.query()
      .where('id', params.id)
      .where('userId', currentUser.id)
      .first()

    if (!subscription) {
      return response.notFound({ message: 'Device not found' })
    }

    await subscription.delete()
    return response.noContent()
  }

  async test({ auth, response }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    const outcome = await sendTestNotification(currentUser.id)
    return response.json(outcome)
  }

  async publicKey({ response }: HttpContext) {
    const publicKey = await getPushPublicKey()
    return response.json({ publicKey })
  }
}
