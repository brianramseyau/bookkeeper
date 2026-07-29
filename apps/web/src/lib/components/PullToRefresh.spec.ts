import { fireEvent, render } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PullToRefresh from './PullToRefresh.svelte'

const IOS_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function touch(clientY: number) {
  return { touches: [{ clientY }] }
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true })
}

afterEach(() => {
  vi.unstubAllGlobals()
  setScrollY(0)
})

describe('PullToRefresh, non-iOS device', () => {
  it('renders nothing and ignores touch gestures', async () => {
    const { container } = render(PullToRefresh)

    await fireEvent.touchStart(window, touch(0))
    await fireEvent.touchMove(window, touch(150))
    await fireEvent.touchEnd(window)

    expect(container.querySelector('svg')).toBeFalsy()
  })
})

describe('PullToRefresh, iOS device', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: IOS_USER_AGENT })
    setScrollY(0)
  })

  it('shows a pull indicator while dragging down from the top of the page', async () => {
    const { container } = render(PullToRefresh)

    await fireEvent.touchStart(window, touch(0))
    await fireEvent.touchMove(window, touch(40))

    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('ignores drags that do not start at the top of the page', async () => {
    setScrollY(10)
    const { container } = render(PullToRefresh)

    await fireEvent.touchStart(window, touch(0))
    await fireEvent.touchMove(window, touch(150))

    expect(container.querySelector('svg')).toBeFalsy()
  })

  it('hides the indicator again when released before crossing the threshold', async () => {
    const { container } = render(PullToRefresh)

    await fireEvent.touchStart(window, touch(0))
    await fireEvent.touchMove(window, touch(20))
    await fireEvent.touchEnd(window)

    expect(container.querySelector('svg')).toBeFalsy()
  })

  it('reloads the page when pulled past the threshold and released', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(PullToRefresh)

    await fireEvent.touchStart(window, touch(0))
    await fireEvent.touchMove(window, touch(150))
    await fireEvent.touchEnd(window)

    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload when the page has already scrolled away from the top', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(PullToRefresh)

    await fireEvent.touchStart(window, touch(0))
    setScrollY(10)
    await fireEvent.touchMove(window, touch(150))
    await fireEvent.touchEnd(window)

    expect(reload).not.toHaveBeenCalled()
  })
})
