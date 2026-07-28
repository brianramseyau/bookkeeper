import type PushSubscription from '#models/push_subscription'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class PushSubscriptionTransformer extends BaseTransformer<PushSubscription> {
  toObject() {
    // `endpoint` is fine to expose (the client needs it to recognize which
    // row is this device's own) - never p256Dh/auth, the encryption keys for
    // this device's push endpoint.
    return this.pick(this.resource, ['id', 'endpoint', 'userAgent', 'createdAt'])
  }
}
