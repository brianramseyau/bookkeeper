import { fireEvent, render, screen, within } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { themeState } from '$lib/stores/theme.svelte'
import NetPositionTrendChart from './NetPositionTrendChart.svelte'

afterEach(() => {
  themeState.current = 'light'
})

const data = [
  { year: 2026, month: 1, income: 400, expense: 100 },
  { year: 2026, month: 2, income: 450, expense: 200 },
  { year: 2026, month: 3, income: 420, expense: 150 },
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

describe('NetPositionTrendChart', () => {
  it('shows a placeholder when there is no data', () => {
    render(NetPositionTrendChart, { data: [], incomeColor: '#0A6B50', expenseColor: '#9C3320' })
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
  })

  it('shows a placeholder when every month is zero, not a $0 axis', () => {
    // The dashboard always passes a full 12-month window, so a fresh
    // install/no-history case sends 12 zero-value entries rather than an
    // empty array - the placeholder must still show for that case.
    render(NetPositionTrendChart, {
      data: [
        { year: 2026, month: 1, income: 0, expense: 0 },
        { year: 2026, month: 2, income: 0, expense: 0 },
      ],
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
  })

  it('renders a legend and a bar pair for every month, plus the net line', () => {
    render(NetPositionTrendChart, { data, incomeColor: '#0A6B50', expenseColor: '#9C3320' })
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Net')).toBeInTheDocument()
    expect(document.querySelectorAll('path[fill="#0A6B50"]')).toHaveLength(3)
    expect(document.querySelectorAll('path[fill="#9C3320"]')).toHaveLength(3)
    // One <circle> net-position marker per month, plus the connecting line.
    expect(document.querySelectorAll('circle')).toHaveLength(3)
  })

  it('shows a hover tooltip with income, expenses and net, and calls onSelectMonth when clicked', async () => {
    const onSelectMonth = vi.fn()
    const { container } = render(NetPositionTrendChart, {
      data,
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
      onSelectMonth,
    })
    const svg = stubBoundingRect(container)

    await fireEvent.pointerMove(svg, { clientX: 10, clientY: 100 })
    expect(screen.getByText('Jan 2026')).toBeInTheDocument()
    expect(screen.getByText('$400.00')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.getByText('$300.00')).toBeInTheDocument()

    await fireEvent.click(svg)
    expect(onSelectMonth).toHaveBeenCalledWith(2026, 1)
  })

  it('positions the hover tooltip against the plot, not the legend', async () => {
    const { container } = render(NetPositionTrendChart, {
      data,
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    const svg = stubBoundingRect(container)

    await fireEvent.pointerMove(svg, { clientX: 10, clientY: 100 })

    const tooltip = screen.getByText('Jan 2026').closest('div')!
    const positioningParent = tooltip.parentElement!
    // The tooltip's `absolute top-0` is relative to this parent - it must
    // wrap only the plot (svg), not also the legend, or `top-0` lands the
    // tooltip on top of the legend row instead of the chart.
    expect(positioningParent.contains(svg)).toBe(true)
    expect(positioningParent.querySelector('svg')).not.toBeNull()
    expect(within(positioningParent).queryByText('Income')).toBeNull()
  })

  it('clears the hover tooltip on pointer leave', async () => {
    const { container } = render(NetPositionTrendChart, {
      data,
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    const svg = stubBoundingRect(container)

    await fireEvent.pointerMove(svg, { clientX: 10, clientY: 100 })
    expect(screen.getByText('Jan 2026')).toBeInTheDocument()

    await fireEvent.pointerLeave(svg)
    expect(screen.queryByText('Jan 2026')).toBeNull()
  })

  it('navigates and selects months with the keyboard', async () => {
    const onSelectMonth = vi.fn()
    const { container } = render(NetPositionTrendChart, {
      data,
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
      onSelectMonth,
    })
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

  it('does nothing on keyboard/pointer interaction when there are no bars', async () => {
    const { container } = render(NetPositionTrendChart, {
      data: [],
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    expect(container.querySelector('svg')).toBeNull()
  })

  it('toggles the table view and lists every month with income, expenses and net', async () => {
    const user = userEvent.setup()
    render(NetPositionTrendChart, { data, incomeColor: '#0A6B50', expenseColor: '#9C3320' })

    expect(screen.queryByRole('table')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'View as table' }))

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Jan 2026')).toBeInTheDocument()
    expect(screen.getByText('Feb 2026')).toBeInTheDocument()
    expect(screen.getByText('Mar 2026')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Net' })).toBeInTheDocument()
    // Jan's net is 400 - 100 = 300.
    expect(screen.getByText('$300.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide table' }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('selects a month by clicking its table row', async () => {
    const onSelectMonth = vi.fn()
    const user = userEvent.setup()
    render(NetPositionTrendChart, {
      data,
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
      onSelectMonth,
    })

    await user.click(screen.getByRole('button', { name: 'View as table' }))
    await user.click(screen.getByText('Feb 2026'))

    expect(onSelectMonth).toHaveBeenCalledWith(2026, 2)
  })

  it('is not keyboard-focusable and has no click handler without onSelectMonth', () => {
    const { container } = render(NetPositionTrendChart, {
      data,
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('tabindex')).toBe('-1')
  })

  it('renders a single-month series without dividing by zero', () => {
    render(NetPositionTrendChart, {
      data: [{ year: 2026, month: 5, income: 500, expense: 80 }],
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    const paths = document.querySelectorAll('path')
    for (const path of paths) {
      expect(path.getAttribute('d')).not.toContain('NaN')
    }
  })

  it('extends the y-axis below zero and dips the net line for a deficit month', () => {
    const { container } = render(NetPositionTrendChart, {
      data: [
        { year: 2026, month: 1, income: 400, expense: 100 },
        // A deficit month: net = 300 - 500 = -200.
        { year: 2026, month: 2, income: 300, expense: 500 },
      ],
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })

    // A gridline below zero must appear once the axis is asked to cover a
    // negative net value.
    expect(screen.getByText(/^-\$/)).toBeInTheDocument()

    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
    const [janY, febY] = [...circles].map((c) => Number(c.getAttribute('cy')))
    // February's deficit month net marker sits below (larger y) January's
    // surplus month net marker in SVG's y-down coordinate space.
    expect(febY).toBeGreaterThan(janY!)
  })
})
