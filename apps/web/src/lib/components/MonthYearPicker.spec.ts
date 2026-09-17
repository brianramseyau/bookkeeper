import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MonthYearPicker from './MonthYearPicker.svelte'

describe('MonthYearPicker', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a placeholder when empty', () => {
    render(MonthYearPicker, { props: { value: '' } })
    expect(screen.getByRole('button', { name: 'Select month' })).toBeInTheDocument()
  })

  it('shows the selected month formatted on the trigger', () => {
    render(MonthYearPicker, { props: { value: '2026-01' } })
    expect(screen.getByRole('button', { name: 'Jan 2026' })).toBeInTheDocument()
  })

  it('opens a panel with the displayed year and all 12 months', async () => {
    const user = userEvent.setup({ delay: null })
    render(MonthYearPicker, { props: { value: '2025-06' } })

    await user.click(screen.getByRole('button', { name: 'Jun 2025' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('2025')).toBeInTheDocument()
    for (const name of [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
  })

  it('selects a month from the currently displayed year', async () => {
    const user = userEvent.setup({ delay: null })
    const onchange = vi.fn()
    render(MonthYearPicker, { props: { value: '2025-06', onchange } })

    const trigger = screen.getByRole('button', { name: 'Jun 2025' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Jul' }))

    expect(onchange).toHaveBeenCalledWith('2025-07')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('navigates years with the arrows before selecting', async () => {
    const user = userEvent.setup({ delay: null })
    const onchange = vi.fn()
    render(MonthYearPicker, { props: { value: '2025-06', onchange } })

    await user.click(screen.getByRole('button', { name: 'Jun 2025' }))
    await user.click(screen.getByRole('button', { name: 'Next year' }))
    await user.click(screen.getByRole('button', { name: 'Jan' }))

    expect(onchange).toHaveBeenCalledWith('2026-01')
  })

  it('navigates back a year with the left arrow', async () => {
    const user = userEvent.setup({ delay: null })
    const onchange = vi.fn()
    render(MonthYearPicker, { props: { value: '2025-06', onchange } })

    await user.click(screen.getByRole('button', { name: 'Jun 2025' }))
    await user.click(screen.getByRole('button', { name: 'Previous year' }))
    await user.click(screen.getByRole('button', { name: 'Mar' }))

    expect(onchange).toHaveBeenCalledWith('2024-03')
  })

  it('defaults an empty picker to the current year', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00.000Z'))
    const user = userEvent.setup({ delay: null })
    const onchange = vi.fn()
    render(MonthYearPicker, { props: { value: '', onchange } })

    await user.click(screen.getByRole('button', { name: 'Select month' }))
    await user.click(screen.getByRole('button', { name: 'Jan' }))

    expect(onchange).toHaveBeenCalledWith('2026-01')
  })

  it('re-clicking the selected month clears the value', async () => {
    const user = userEvent.setup({ delay: null })
    const onchange = vi.fn()
    render(MonthYearPicker, { props: { value: '2025-06', onchange } })

    await user.click(screen.getByRole('button', { name: 'Jun 2025' }))
    await user.click(screen.getByRole('button', { name: 'Jun' }))

    expect(onchange).toHaveBeenCalledWith('')
  })

  it('closes without changing the value when clicking outside', async () => {
    const user = userEvent.setup({ delay: null })
    const onchange = vi.fn()
    render(MonthYearPicker, { props: { value: '2025-06', onchange } })

    await user.click(screen.getByRole('button', { name: 'Jun 2025' }))
    await user.click(screen.getByRole('button', { name: 'Close month picker' }))

    expect(onchange).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('highlights the current month in the grid', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T00:00:00.000Z'))
    const user = userEvent.setup({ delay: null })
    render(MonthYearPicker, { props: { value: '2025-06' } })

    await user.click(screen.getByRole('button', { name: 'Jun 2025' }))
    await user.click(screen.getByRole('button', { name: 'Next year' }))

    expect(screen.getByRole('button', { name: 'Jan' })).toHaveClass('ring-primary/40')
    expect(screen.getByRole('button', { name: 'Feb' })).not.toHaveClass('ring-primary/40')
  })

  it('flips the panel to open above the trigger when there is no room below the viewport', async () => {
    const user = userEvent.setup({ delay: null })
    render(MonthYearPicker, { props: { value: '2025-06' } })

    const trigger = screen.getByRole('button', { name: 'Jun 2025' })
    // jsdom reports zeroed rects; fake a trigger sitting just above the
    // bottom edge so the panel can't open below it.
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 720,
      bottom: 760,
      left: 10,
      right: 138,
      width: 128,
      height: 40,
      x: 10,
      y: 720,
      toJSON: () => ({}),
    } as DOMRect)

    await user.click(trigger)

    const panel = screen.getByRole('dialog')
    const top = Number.parseInt(panel.style.top, 10)
    expect(top).toBeGreaterThanOrEqual(8)
    expect(top).toBeLessThan(720)
  })

  // The panel is portalled to `document.body` (outside a caller's own Sheet/
  // Dialog focus trap - see the component's comment), so it must manage
  // focus itself rather than relying on ambient Tab order.
  describe('keyboard focus management', () => {
    it('moves focus to the selected month on open, and back to the trigger on Escape', async () => {
      const user = userEvent.setup({ delay: null })
      render(MonthYearPicker, { props: { value: '2025-06' } })

      const trigger = screen.getByRole('button', { name: 'Jun 2025' })
      await user.click(trigger)

      expect(screen.getByRole('button', { name: 'Jun', pressed: true })).toHaveFocus()

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(trigger).toHaveFocus()
    })

    it('focuses the first control when no month is selected in the displayed year', async () => {
      const user = userEvent.setup({ delay: null })
      render(MonthYearPicker, { props: { value: '' } })

      await user.click(screen.getByRole('button', { name: 'Select month' }))

      expect(screen.getByRole('button', { name: 'Previous year' })).toHaveFocus()
    })

    it('traps Tab within the panel, wrapping from the last control back to the first', async () => {
      const user = userEvent.setup({ delay: null })
      render(MonthYearPicker, { props: { value: '' } })

      await user.click(screen.getByRole('button', { name: 'Select month' }))
      const first = screen.getByRole('button', { name: 'Previous year' })
      const last = screen.getByRole('button', { name: 'Dec' })
      expect(first).toHaveFocus()

      await user.keyboard('{Shift>}{Tab}{/Shift}')
      expect(last).toHaveFocus()

      await user.keyboard('{Tab}')
      expect(first).toHaveFocus()
    })
  })
})
