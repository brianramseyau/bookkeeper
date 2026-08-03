import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MonthNav } from '$lib/month-nav.svelte'
import MonthNavHeader from './MonthNavHeader.svelte'

function makeNav(overrides: Partial<MonthNav> = {}): MonthNav {
  return {
    year: 2026,
    month: 3,
    isCurrentMonth: false,
    changeMonth: vi.fn(),
    goToCurrentMonth: vi.fn(),
    ...overrides,
  } as unknown as MonthNav
}

describe('MonthNavHeader', () => {
  it('shows the month and year', () => {
    render(MonthNavHeader, { nav: makeNav({ year: 2026, month: 7 }) })
    expect(screen.getByText('July 2026')).toBeInTheDocument()
  })

  it('hides and disables "This Month" while already on the current month', () => {
    render(MonthNavHeader, { nav: makeNav({ isCurrentMonth: true }) })
    const button = screen.getByText('This Month')
    expect(button).toBeDisabled()
    expect(button.className).toContain('invisible')
  })

  it('calls goToCurrentMonth when "This Month" is clicked', async () => {
    const nav = makeNav({ isCurrentMonth: false })
    render(MonthNavHeader, { nav })
    await userEvent.click(screen.getByRole('button', { name: 'This Month' }))
    expect(nav.goToCurrentMonth).toHaveBeenCalledOnce()
  })

  it('calls changeMonth(-1) and changeMonth(1) for Prev/Next', async () => {
    const nav = makeNav()
    render(MonthNavHeader, { nav })
    await userEvent.click(screen.getByRole('button', { name: '← Prev' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(nav.changeMonth).toHaveBeenNthCalledWith(1, -1)
    expect(nav.changeMonth).toHaveBeenNthCalledWith(2, 1)
  })
})
