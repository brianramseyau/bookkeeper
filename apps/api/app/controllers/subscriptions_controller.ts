import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserSubscription from '#models/user_subscription'
import UserSubscriptionTransformer from '#transformers/user_subscription_transformer'
import {
  createUserSubscriptionValidator,
  updateUserSubscriptionValidator,
} from '#validators/user_subscription'

export default class SubscriptionsController {
  async index({ request, serialize }: HttpContext) {
    const userId = request.input('userId')

    const query = UserSubscription.query().orderBy('name', 'asc')
    if (userId) {
      query.where('userId', Number(userId))
    }

    const subscriptions = await query
    return serialize(UserSubscriptionTransformer.transform(subscriptions))
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createUserSubscriptionValidator)
    const subscription = await UserSubscription.create({
      userId: payload.userId,
      name: payload.name,
      categoryId: payload.categoryId ?? null,
      amount: payload.amount,
      dayOfMonth: payload.dayOfMonth ?? null,
      notes: payload.notes ?? null,
    })

    return response.created(await serialize(UserSubscriptionTransformer.transform(subscription)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const subscription = await UserSubscription.findOrFail(params.id)
    const payload = await request.validateUsing(updateUserSubscriptionValidator)
    subscription.merge(payload)
    await subscription.save()
    return serialize(UserSubscriptionTransformer.transform(subscription))
  }

  async destroy({ params, response }: HttpContext) {
    const subscription = await UserSubscription.findOrFail(params.id)
    subscription.isActive = false
    await subscription.save()
    return response.noContent()
  }

  async summary({ response }: HttpContext) {
    const [users, subscriptions] = await Promise.all([
      User.query().orderBy('fullName', 'asc'),
      UserSubscription.query().where('isActive', true),
    ])

    const results = users.map((user) => {
      const userSubscriptions = subscriptions.filter((s) => s.userId === user.id)
      const total = userSubscriptions.reduce((sum, s) => sum + s.amount, 0)
      return {
        userId: user.id,
        fullName: user.fullName,
        total: Math.round(total * 100) / 100,
        count: userSubscriptions.length,
      }
    })

    return response.json({ data: results })
  }
}
