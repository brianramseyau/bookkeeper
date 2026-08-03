import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import HelpTooltip from './HelpTooltip.svelte'

describe('HelpTooltip', () => {
  it('shows the tooltip text on click, then closes on outside click', async () => {
    const user = userEvent.setup()
    render(HelpTooltip, {
      label: 'Why is this estimated?',
      text: 'No record for this month this far back.',
    })

    expect(screen.queryByRole('tooltip')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Why is this estimated?' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'No record for this month this far back.'
    )

    await user.click(screen.getByRole('button', { name: 'Close tooltip' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
