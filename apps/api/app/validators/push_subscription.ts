import vine from '@vinejs/vine'

/** Matches the shape of the browser's `PushSubscription.toJSON()`. */
export const createPushSubscriptionValidator = vine.create({
  endpoint: vine.string().trim().minLength(1),
  keys: vine.object({
    p256dh: vine.string().trim().minLength(1),
    auth: vine.string().trim().minLength(1),
  }),
})
