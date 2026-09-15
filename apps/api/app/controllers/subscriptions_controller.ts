import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserSubscription from '#models/user_subscription'
import SubscriptionPayment from '#models/subscription_payment'
import UserSubscriptionTransformer from '#transformers/user_subscription_transformer'
import SubscriptionPaymentTransformer from '#transformers/subscription_payment_transformer'
import {
  createUserSubscriptionValidator,
  updateUserSubscriptionValidator,
} from '#validators/user_subscription'
import { upsertSubscriptionPaymentValidator } from '#validators/subscription_payment'
import { RollingAverageService } from '#services/rolling_average_service'

export default class SubscriptionsController {
  async index({ request, serialize }: HttpContext) {
    const userId = request.input('userId')

    const query = UserSubscription.query().orderBy('name', 'asc')
    if (userId) {
      query.where('userId', Number(userId))
    }
    if (!request.input('includeHidden')) {
      query.where('isActive', true).andWhere('isPaused', false).andWhere('isArchived', false)
    }

    const subscriptions = await query
    return serialize(UserSubscriptionTransformer.transform(subscriptions))
  }

  async show({ params, serialize }: HttpContext) {
    const subscription = await UserSubscription.findOrFail(params.id)
    return serialize(UserSubscriptionTransformer.transform(subscription))
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
    if (payload.isArchived) payload.isPaused = false
    subscription.merge(payload)
    await subscription.save()
    return serialize(UserSubscriptionTransformer.transform(subscription))
  }

  async destroy({ params, response }: HttpContext) {
    const subscription = await UserSubscription.findOrFail(params.id)
    if (!subscription.isArchived) {
      return response.conflict({
        message: 'Only archived subscriptions can be permanently removed',
      })
    }

    // Hard delete - the DB's CASCADE FK deletes subscription_payments.
    await subscription.delete()

    return response.noContent()
  }

  async payments({ params, serialize }: HttpContext) {
    const userSubscriptionId = Number(params.id)
    await UserSubscription.findOrFail(userSubscriptionId)

    const payments = await SubscriptionPayment.query()
      .where('userSubscriptionId', userSubscriptionId)
      .orderBy('year', 'desc')
      .orderBy('month', 'desc')

    return serialize(SubscriptionPaymentTransformer.transform(payments))
  }

  async destroyPayment({ params, response }: HttpContext) {
    const payment = await SubscriptionPayment.findOrFail(params.id)
    await payment.delete()
    return response.noContent()
  }

  async trend({ params, response }: HttpContext) {
    const userSubscriptionId = Number(params.id)
    const subscription = await UserSubscription.findOrFail(userSubscriptionId)
    const payments = await SubscriptionPayment.query().where(
      'userSubscriptionId',
      userSubscriptionId
    )

    const service = new RollingAverageService()
    return response.json(
      service.computeTrendWithFallback(
        payments.map((payment) => ({
          year: payment.year,
          month: payment.month,
          amount: payment.amount,
        })),
        subscription.amount
      )
    )
  }

  async upsertPayment({ params, request, serialize }: HttpContext) {
    const userSubscriptionId = Number(params.id)
    await UserSubscription.findOrFail(userSubscriptionId)
    const payload = await request.validateUsing(upsertSubscriptionPaymentValidator)
    const year = Number(params.year)
    const month = Number(params.month)

    // Same distinguish-omitted-from-unset reasoning as RecurringBillsController
    // .upsertPayment - the Paid checkbox and the amount-edit form each send
    // only their own field, and neither should stomp the other's already-saved
    // value.
    let payment = await SubscriptionPayment.query()
      .where({ userSubscriptionId, year, month })
      .first()
    if (payment) {
      payment.merge({
        ...(payload.paid !== undefined ? { paid: payload.paid } : {}),
        ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
      })
      await payment.save()
    } else {
      payment = await SubscriptionPayment.create({
        userSubscriptionId,
        year,
        month,
        paid: payload.paid ?? false,
        amount: payload.amount ?? null,
      })
    }

    return serialize(SubscriptionPaymentTransformer.transform(payment))
  }

  async summary({ response }: HttpContext) {
    const [users, subscriptions] = await Promise.all([
      User.query().orderBy('fullName', 'asc'),
      UserSubscription.query()
        .where('isActive', true)
        .andWhere('isPaused', false)
        .andWhere('isArchived', false),
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
