import webpush, { WebPushError } from 'web-push'
import logger from '@adonisjs/core/services/logger'
import PushConfig from '#models/push_config'
import PushSubscription from '#models/push_subscription'

const CONFIG_ID = 1

/**
 * Contact info shown to the browser's push service - not a deliverable
 * address, just VAPID metadata. Must be on a real, resolvable domain: Apple's
 * web push service validates the JWT `sub` claim and rejects a reserved,
 * non-public pseudo-domain (`.local`, `localhost`, etc.) with a 403
 * "BadJwtToken", silently dropping every notification to iOS devices while
 * other browsers stay unaffected - see `1785239286763_fix_vapid_subject_domain.ts`
 * for the migration that corrected this on an already-seeded database.
 */
const VAPID_SUBJECT = 'mailto:admin@example.com'

export type PushPayload = {
  title: string
  body: string
  url: string
}

export type SendOutcome = { pruned: boolean }

/**
 * The household-wide VAPID key pair, generated once on first use and stored
 * in the database - there's nothing for the user to configure or remember,
 * unlike a secret set via `.env`.
 */
export async function getPushConfig(): Promise<PushConfig> {
  const existing = await PushConfig.find(CONFIG_ID)
  if (existing) return existing

  const keys = webpush.generateVAPIDKeys()
  return PushConfig.create({
    id: CONFIG_ID,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: VAPID_SUBJECT,
  })
}

export async function getPushPublicKey(): Promise<string> {
  const config = await getPushConfig()
  return config.publicKey
}

/**
 * Sends one push notification to one subscription. A 404/410 response means
 * the browser has dropped that subscription (uninstalled, permission
 * revoked, etc.) - treated as expected cleanup rather than a failure, so the
 * stale row is deleted and `{ pruned: true }` is returned instead of
 * throwing. Any other error propagates for the caller to log.
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<SendOutcome> {
  const config = await getPushConfig()
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey)

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256Dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    )
    return { pruned: false }
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      await subscription.delete()
      return { pruned: true }
    }
    throw error
  }
}

/**
 * Sends a fixed test payload to every device the given user has registered.
 * One device's failure (e.g. the push service rejecting the request) doesn't
 * stop the rest - each is attempted independently and failures are logged
 * with the full `WebPushError` (status code and response body included) so
 * the actual reason is visible in the server logs rather than only a generic
 * "unexpected response code" reaching the browser.
 */
export async function sendTestNotification(
  userId: number
): Promise<{ sent: number; pruned: number; failed: number }> {
  const subscriptions = await PushSubscription.query().where('userId', userId)

  let sent = 0
  let pruned = 0
  let failed = 0
  for (const subscription of subscriptions) {
    try {
      const outcome = await sendPushNotification(subscription, {
        title: 'Test notification',
        body: 'Push notifications are working.',
        url: '/',
      })
      if (outcome.pruned) pruned++
      else sent++
    } catch (error) {
      failed++
      logger.error(
        { err: error, userId, subscriptionId: subscription.id },
        'Failed to send test push notification'
      )
    }
  }

  return { sent, pruned, failed }
}
