import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MonthNavState } from '$lib/stores/month.svelte'
import MonthNavHeader from './MonthNavHeader.svelte'

function makeNav(overrides: Partial<MonthNavState> = {}): MonthNavState {
  return {
    year: 2026,
    month: 3,
    isCurrentMonth: false,
    changeMonth: vi.fn(),
    goToCurrentMonth: vi.fn(),
    ...overrides,
  } as unknown as MonthNavState
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

  describe('compact variant', () => {
    it('shows the month/year as a heading, flanked by chevron icon buttons', () => {
      render(MonthNavHeader, { nav: makeNav({ year: 2026, month: 7 }), variant: 'compact' })
      expect(screen.getByRole('heading', { name: 'July 2026' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument()
    })

    it('calls changeMonth(-1) and changeMonth(1) from the chevrons', async () => {
      const nav = makeNav()
      render(MonthNavHeader, { nav, variant: 'compact' })
      await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
      await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
      expect(nav.changeMonth).toHaveBeenNthCalledWith(1, -1)
      expect(nav.changeMonth).toHaveBeenNthCalledWith(2, 1)
    })

    it('calls goToCurrentMonth when the month heading is tapped', async () => {
      const nav = makeNav({ isCurrentMonth: false, year: 2026, month: 7 })
      render(MonthNavHeader, { nav, variant: 'compact' })
      await userEvent.click(screen.getByRole('button', { name: 'July 2026' }))
      expect(nav.goToCurrentMonth).toHaveBeenCalledOnce()
    })

    it('disables the month heading while already on the current month', () => {
      render(MonthNavHeader, {
        nav: makeNav({ isCurrentMonth: true, year: 2026, month: 7 }),
        variant: 'compact',
      })
      expect(screen.getByRole('button', { name: 'July 2026' })).toBeDisabled()
    })
  })
})
