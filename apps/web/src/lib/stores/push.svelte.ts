import {
  getPushPublicKey,
  createPushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
} from '$lib/api/push-subscriptions'

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

/**
 * Service workers (and therefore the Push API) are only ever exposed in a
 * "secure context" - HTTPS, or `localhost`/`127.0.0.1`. On a typical home-LAN
 * deployment (e.g. unRAID, reached by IP with no reverse proxy) that's false,
 * and no browser lets an app opt out of the restriction - so when
 * `supported` is false specifically because of this, the fix is "put a
 * TLS-terminating reverse proxy in front," not "use a different browser."
 */
function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
}

class PushState {
  supported = $state(isSupported())
  secureContext = $state(isSecureContext())
  subscribed = $state(false)
  loading = $state(false)
}

export const pushState = new PushState()

/** The browser's `applicationServerKey` option wants a raw byte array, not the base64url string the API returns. */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

/** Registers the service worker and syncs `pushState.subscribed` with whatever this browser already has - called once from the root layout. */
export async function registerServiceWorker(): Promise<void> {
  if (!pushState.supported) return

  try {
    await navigator.serviceWorker.register('/service-worker.js')
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    pushState.subscribed = subscription !== null
  } catch {
    // Not fatal - notifications just stay unavailable on this device.
  }
}

export async function subscribeToPush(): Promise<void> {
  if (!pushState.supported) return

  pushState.loading = true
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const { publicKey } = await getPushPublicKey()
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey) as BufferSource,
    })

    const json = subscription.toJSON()
    await createPushSubscription({
      endpoint: json.endpoint!,
      keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
    })
    pushState.subscribed = true
  } finally {
    pushState.loading = false
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushState.supported) return

  pushState.loading = true
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      const existing = await listPushSubscriptions()
      const match = existing.find((s) => s.endpoint === endpoint)
      if (match) await deletePushSubscription(match.id)
    }
    pushState.subscribed = false
  } finally {
    pushState.loading = false
  }
}
