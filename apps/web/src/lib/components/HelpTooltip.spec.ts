import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import HelpTooltip from './HelpTooltip.svelte'

// See ActionMenu.spec.ts's top-of-file comment for why an open bits-ui
// floating panel needs `{ hidden: true }` on role queries under jsdom (no
// real layout, so the content never leaves `visibility: hidden`) and why an
// outside click has to be fired with `fireEvent` at an explicit nonzero
// coordinate and awaited with `waitFor` rather than a role/name query or a
// fixed delay - the same mechanics apply here since HelpTooltip is now a
// thin wrapper around the same bits-ui Popover primitive as ActionMenu's
// DropdownMenu.
const inOpenPanel = { hidden: true } as const

describe('HelpTooltip', () => {
  it('shows the tooltip text on click, then closes on outside click', async () => {
    const user = userEvent.setup()
    render(HelpTooltip, {
      label: 'Why is this estimated?',
      text: 'No record for this month this far back.',
    })

    expect(screen.queryByRole('tooltip', inOpenPanel)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Why is this estimated?' }))
    expect(screen.getByRole('tooltip', inOpenPanel)).toHaveTextContent(
      'No record for this month this far back.'
    )

    await new Promise((resolve) => setTimeout(resolve, 10))
    await fireEvent.pointerDown(document.body, { clientX: 999, clientY: 999, button: 0 })
    await waitFor(() => expect(screen.queryByRole('tooltip', inOpenPanel)).toBeNull())
  })

  it('sets the explanation as both the trigger title and the panel text', async () => {
    const user = userEvent.setup()
    render(HelpTooltip, { label: 'Why is this estimated?', text: 'Some help text.' })

    expect(screen.getByRole('button', { name: 'Why is this estimated?' })).toHaveAttribute(
      'title',
      'Some help text.'
    )

    await user.click(screen.getByRole('button', { name: 'Why is this estimated?' }))
    expect(screen.getByRole('tooltip', inOpenPanel)).toHaveTextContent('Some help text.')
  })
})
