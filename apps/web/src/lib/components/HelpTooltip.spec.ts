import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HelpTooltip from './HelpTooltip.svelte'

const TOOLTIP_WIDTH = 224
const VIEWPORT_MARGIN = 8

function mockTriggerRect(rect: Partial<DOMRect>) {
  vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: 16,
    height: 16,
    top: 0,
    right: 0,
    bottom: 16,
    left: 0,
    toJSON: () => {},
    ...rect,
  })
}

function getTooltipLeft() {
  const style = screen.getByRole('tooltip').getAttribute('style') ?? ''
  return Number(style.match(/left:\s*(-?\d+(?:\.\d+)?)px/)?.[1])
}

describe('HelpTooltip', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the tooltip text on click, then closes on outside click', async () => {
    const user = userEvent.setup()
    render(HelpTooltip, {
      label: 'Why is this estimated?',
      text: 'No record for this month this far back.',
    })

    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Why is this estimated?' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('No record for this month this far back.')

    await user.click(screen.getByRole('button', { name: 'Close tooltip' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('clamps the tooltip within the viewport when the trigger is near the left edge', async () => {
    const user = userEvent.setup()
    mockTriggerRect({ left: 0, right: 16, width: 16 })

    render(HelpTooltip, { label: 'Why is this estimated?', text: 'Some help text.' })
    await user.click(screen.getByRole('button', { name: 'Why is this estimated?' }))

    expect(getTooltipLeft()).toBe(VIEWPORT_MARGIN)
  })

  it('clamps the tooltip within the viewport when the trigger is near the right edge', async () => {
    const user = userEvent.setup()
    const viewportWidth = window.innerWidth
    mockTriggerRect({ left: viewportWidth - 16, right: viewportWidth, width: 16 })

    render(HelpTooltip, { label: 'Why is this estimated?', text: 'Some help text.' })
    await user.click(screen.getByRole('button', { name: 'Why is this estimated?' }))

    expect(getTooltipLeft()).toBe(viewportWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN)
  })
})
