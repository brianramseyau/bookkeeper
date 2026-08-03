import vine from '@vinejs/vine'

/**
 * Real push-service origins used by the household's browsers - Chrome/Edge
 * (FCM) and Safari (Apple's web push service). Without this allowlist,
 * `endpoint` is POSTed to verbatim by `sendPushNotification`
 * (`app/services/push_service.ts`), letting an authenticated account point a
 * subscription at an internal LAN address and trigger an SSRF request via
 * `POST /api/push-subscriptions/test`. Only add an origin here once it's
 * confirmed against the Web Push spec and the browsers actually in use -
 * an incomplete list silently breaks notification delivery.
 */
const ALLOWED_PUSH_ENDPOINT_ORIGINS = /^https:\/\/(fcm\.googleapis\.com|web\.push\.apple\.com)\//

/** Matches the shape of the browser's `PushSubscription.toJSON()`. */
export const createPushSubscriptionValidator = vine.create({
  endpoint: vine.string().trim().minLength(1).regex(ALLOWED_PUSH_ENDPOINT_ORIGINS),
  keys: vine.object({
    p256dh: vine.string().trim().minLength(1),
    auth: vine.string().trim().minLength(1),
  }),
})
