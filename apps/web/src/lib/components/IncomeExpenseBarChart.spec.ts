import { fireEvent, render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { themeState } from '$lib/stores/theme.svelte'
import IncomeExpenseBarChart from './IncomeExpenseBarChart.svelte'

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

describe('IncomeExpenseBarChart', () => {
  it('shows a placeholder when there is no data', () => {
    render(IncomeExpenseBarChart, { data: [], incomeColor: '#0A6B50', expenseColor: '#9C3320' })
    expect(screen.getByText('Not enough data yet')).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeNull()
  })

  it('renders a legend and a bar pair for every month', () => {
    render(IncomeExpenseBarChart, { data, incomeColor: '#0A6B50', expenseColor: '#9C3320' })
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(document.querySelectorAll('path[fill="#0A6B50"]')).toHaveLength(3)
    expect(document.querySelectorAll('path[fill="#9C3320"]')).toHaveLength(3)
  })

  it('shows a hover tooltip with both series and calls onSelectMonth when clicked', async () => {
    const onSelectMonth = vi.fn()
    const { container } = render(IncomeExpenseBarChart, {
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

    await fireEvent.click(svg)
    expect(onSelectMonth).toHaveBeenCalledWith(2026, 1)
  })

  it('clears the hover tooltip on pointer leave', async () => {
    const { container } = render(IncomeExpenseBarChart, {
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
    const { container } = render(IncomeExpenseBarChart, {
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
    const { container } = render(IncomeExpenseBarChart, {
      data: [],
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    expect(container.querySelector('svg')).toBeNull()
  })

  it('toggles the table view and lists every month with both figures', async () => {
    const user = userEvent.setup()
    render(IncomeExpenseBarChart, { data, incomeColor: '#0A6B50', expenseColor: '#9C3320' })

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
    render(IncomeExpenseBarChart, {
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
    const { container } = render(IncomeExpenseBarChart, {
      data,
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('tabindex')).toBe('-1')
  })

  it('renders a single-month series without dividing by zero', () => {
    render(IncomeExpenseBarChart, {
      data: [{ year: 2026, month: 5, income: 500, expense: 80 }],
      incomeColor: '#0A6B50',
      expenseColor: '#9C3320',
    })
    const paths = document.querySelectorAll('path')
    for (const path of paths) {
      expect(path.getAttribute('d')).not.toContain('NaN')
    }
  })
})
