import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { themeState } from '$lib/stores/theme.svelte'
import MonthlyExpenseChart from './MonthlyExpenseChart.svelte'

afterEach(() => {
  themeState.current = 'light'
})

const data = [
  { year: 2026, month: 1, total: 100 },
  { year: 2026, month: 2, total: 200 },
  { year: 2026, month: 3, total: 150 },
]

function stubBoundingRect(container: HTMLElement) {
  const svg = container.querySelector('svg')!
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    width: 720,
    height: 240,
    left: 0,
    top: 0,
    right: 720,
    bottom: 240,
    x: 0,
    y: 0,
    toJSON: () => {},
  })
  return svg
}

describe('MonthlyExpenseChart', () => {
  it('shows a placeholder when there is no data', () => {
    render(MonthlyExpenseChart, { data: [] })
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
  })

  it('renders a line and the latest value label', () => {
    render(MonthlyExpenseChart, { data })
    expect(document.querySelector('svg')).not.toBeNull()
    expect(document.querySelector('path')).not.toBeNull()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
  })

  it('shows a hover tooltip and calls onSelectMonth when clicked', async () => {
    const onSelectMonth = vi.fn()
    const { container } = render(MonthlyExpenseChart, { data, onSelectMonth })
    const svg = stubBoundingRect(container)

    await fireEvent.pointerMove(svg, { clientX: 10, clientY: 100 })
    expect(screen.getByText('Jan 2026')).toBeInTheDocument()

    await fireEvent.click(svg)
    expect(onSelectMonth).toHaveBeenCalledWith(2026, 1)
  })

  it('clears the hover tooltip on pointer leave', async () => {
    const { container } = render(MonthlyExpenseChart, { data })
    const svg = stubBoundingRect(container)

    await fireEvent.pointerMove(svg, { clientX: 10, clientY: 100 })
    expect(screen.getByText('Jan 2026')).toBeInTheDocument()

    await fireEvent.pointerLeave(svg)
    expect(screen.queryByText('Jan 2026')).toBeNull()
  })

  it('navigates and selects points with the keyboard', async () => {
    const onSelectMonth = vi.fn()
    const { container } = render(MonthlyExpenseChart, { data, onSelectMonth })
    const svg = container.querySelector('svg')!
    svg.focus()

    await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByText('Jan 2026')).toBeInTheDocument()

    await userEvent.keyboard('{ArrowRight}')
    expect(await screen.findByText('Feb 2026')).toBeInTheDocument()

    await userEvent.keyboard('{ArrowLeft}')
    expect(await screen.findByText('Jan 2026')).toBeInTheDocument()

    await userEvent.keyboard('{Enter}')
    expect(onSelectMonth).toHaveBeenCalledWith(2026, 1)
  })

  it('does nothing on keyboard/pointer interaction when there are no points', async () => {
    const { container } = render(MonthlyExpenseChart, { data: [] })
    expect(container.querySelector('svg')).toBeNull()
  })

  it('toggles the table view and lists every month', async () => {
    const user = userEvent.setup()
    render(MonthlyExpenseChart, { data })

    expect(screen.queryByRole('table')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'View as table' }))

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Jan 2026')).toBeInTheDocument()
    expect(screen.getByText('Feb 2026')).toBeInTheDocument()
    expect(screen.getByText('Mar 2026')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide table' }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('selects a month by clicking its table row', async () => {
    const onSelectMonth = vi.fn()
    const user = userEvent.setup()
    render(MonthlyExpenseChart, { data, onSelectMonth })

    await user.click(screen.getByRole('button', { name: 'View as table' }))
    await user.click(screen.getByText('Feb 2026'))

    expect(onSelectMonth).toHaveBeenCalledWith(2026, 2)
  })

  it('uses dark-mode colors when the theme is dark', () => {
    themeState.current = 'dark'
    render(MonthlyExpenseChart, { data })
    const path = document.querySelector('path:last-of-type')
    expect(path?.getAttribute('stroke')).toBe('#E5ECE8')
  })

  it('renders a single-point series without a line-step division by zero', () => {
    render(MonthlyExpenseChart, { data: [{ year: 2026, month: 5, total: 80 }] })
    const path = document.querySelector('path')
    expect(path?.getAttribute('d')).not.toContain('NaN')
  })

  it('is not keyboard-focusable and has no click handler without onSelectMonth', () => {
    const { container } = render(MonthlyExpenseChart, { data })
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('tabindex')).toBe('-1')
  })
})
