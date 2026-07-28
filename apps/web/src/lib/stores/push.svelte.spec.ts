import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPushPublicKey,
  createPushSubscription,
  deletePushSubscription,
  listPushSubscriptions,
} from '$lib/api/push-subscriptions'

vi.mock('$lib/api/push-subscriptions', () => ({
  getPushPublicKey: vi.fn(),
  createPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
  listPushSubscriptions: vi.fn(),
}))

describe('push store, unsupported browser (default jsdom)', () => {
  it('supported is false and every action is a no-op', async () => {
    vi.resetModules()
    const { pushState, registerServiceWorker, subscribeToPush, unsubscribeFromPush } =
      await import('./push.svelte')

    expect(pushState.supported).toBe(false)

    await registerServiceWorker()
    await subscribeToPush()
    await unsubscribeFromPush()

    expect(pushState.subscribed).toBe(false)
    expect(getPushPublicKey).not.toHaveBeenCalled()
  })
})

describe('push store, insecure context', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('secureContext reflects window.isSecureContext so the UI can explain why push is unavailable', async () => {
    vi.stubGlobal('isSecureContext', false)
    vi.resetModules()

    const { pushState } = await import('./push.svelte')

    expect(pushState.secureContext).toBe(false)
  })
})

describe('push store, supported browser', () => {
  let pushManagerSubscription: { endpoint: string; toJSON: () => unknown } | null
  let subscribeMock: ReturnType<typeof vi.fn>
  let registerMock: ReturnType<typeof vi.fn>
  let requestPermissionMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    vi.mocked(getPushPublicKey).mockReset()
    vi.mocked(createPushSubscription).mockReset()
    vi.mocked(deletePushSubscription).mockReset()
    vi.mocked(listPushSubscriptions).mockReset()

    pushManagerSubscription = null
    subscribeMock = vi.fn(async () => {
      pushManagerSubscription = {
        endpoint: 'https://push.example.com/abc',
        toJSON: () => ({
          endpoint: 'https://push.example.com/abc',
          keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
        }),
      }
      return pushManagerSubscription
    })

    const registration = {
      pushManager: {
        getSubscription: vi.fn(async () => pushManagerSubscription),
        subscribe: subscribeMock,
      },
    }
    registerMock = vi.fn(async () => registration)
    requestPermissionMock = vi.fn(async () => 'granted')

    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        register: registerMock,
        ready: Promise.resolve(registration),
      },
    })
    vi.stubGlobal('PushManager', function () {})
    vi.stubGlobal('Notification', { requestPermission: requestPermissionMock })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('registerServiceWorker registers the worker and reflects an existing subscription', async () => {
    pushManagerSubscription = {
      endpoint: 'https://push.example.com/existing',
      toJSON: () => ({}),
    }
    const { pushState, registerServiceWorker } = await import('./push.svelte')

    expect(pushState.supported).toBe(true)
    await registerServiceWorker()

    expect(registerMock).toHaveBeenCalledWith('/service-worker.js')
    expect(pushState.subscribed).toBe(true)
  })

  it('subscribeToPush does nothing when permission is denied', async () => {
    requestPermissionMock.mockResolvedValue('denied')
    const { pushState, subscribeToPush } = await import('./push.svelte')

    await subscribeToPush()

    expect(subscribeMock).not.toHaveBeenCalled()
    expect(pushState.subscribed).toBe(false)
  })

  it('subscribeToPush subscribes and registers the subscription with the API', async () => {
    vi.mocked(getPushPublicKey).mockResolvedValue({ publicKey: 'QUJD' })
    vi.mocked(createPushSubscription).mockResolvedValue({
      id: 1,
      endpoint: 'https://push.example.com/abc',
      userAgent: null,
      createdAt: '2026-01-01T00:00:00.000+00:00',
    })
    const { pushState, subscribeToPush } = await import('./push.svelte')

    await subscribeToPush()

    expect(subscribeMock).toHaveBeenCalled()
    expect(createPushSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example.com/abc',
      keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
    })
    expect(pushState.subscribed).toBe(true)
  })

  it('unsubscribeFromPush is a no-op when there is no active subscription', async () => {
    const { pushState, unsubscribeFromPush } = await import('./push.svelte')

    await unsubscribeFromPush()

    expect(deletePushSubscription).not.toHaveBeenCalled()
    expect(pushState.subscribed).toBe(false)
  })

  it("unsubscribeFromPush removes the browser subscription and this device's server-side record", async () => {
    const unsubscribeMock = vi.fn(async () => true)
    pushManagerSubscription = {
      endpoint: 'https://push.example.com/abc',
      toJSON: () => ({}),
      // @ts-expect-error - test double only implements what's used
      unsubscribe: unsubscribeMock,
    }
    vi.mocked(listPushSubscriptions).mockResolvedValue([
      {
        id: 7,
        endpoint: 'https://push.example.com/abc',
        userAgent: null,
        createdAt: '2026-01-01T00:00:00.000+00:00',
      },
    ])
    const { pushState, unsubscribeFromPush } = await import('./push.svelte')

    await unsubscribeFromPush()

    expect(unsubscribeMock).toHaveBeenCalled()
    expect(deletePushSubscription).toHaveBeenCalledWith(7)
    expect(pushState.subscribed).toBe(false)
  })

  it('unsubscribeFromPush still unsubscribes locally when the server has no matching record', async () => {
    const unsubscribeMock = vi.fn(async () => true)
    pushManagerSubscription = {
      endpoint: 'https://push.example.com/already-gone',
      toJSON: () => ({}),
      // @ts-expect-error - test double only implements what's used
      unsubscribe: unsubscribeMock,
    }
    vi.mocked(listPushSubscriptions).mockResolvedValue([])
    const { pushState, unsubscribeFromPush } = await import('./push.svelte')

    await unsubscribeFromPush()

    expect(unsubscribeMock).toHaveBeenCalled()
    expect(deletePushSubscription).not.toHaveBeenCalled()
    expect(pushState.subscribed).toBe(false)
  })
})
