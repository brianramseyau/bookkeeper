import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CategoryBreakdownList from './CategoryBreakdownList.svelte'

describe('CategoryBreakdownList', () => {
  it('shows a placeholder when there is no spend', () => {
    render(CategoryBreakdownList, { data: [] })
    expect(screen.getByText('No spend recorded yet')).toBeInTheDocument()
  })

  it('renders each category with its name and total', () => {
    render(CategoryBreakdownList, {
      data: [
        { id: 1, name: 'Utilities', color: '#0066b2', total: 400 },
        { id: 2, name: 'Groceries', color: '#72b258', total: 300 },
      ],
    })
    expect(screen.getByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText('$400.00')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('$300.00')).toBeInTheDocument()
  })

  it('scales the largest bar to full width', () => {
    const { container } = render(CategoryBreakdownList, {
      data: [
        { id: 1, name: 'Utilities', color: '#0066b2', total: 400 },
        { id: 2, name: 'Groceries', color: '#72b258', total: 200 },
      ],
    })
    const bars = container.querySelectorAll('li > div:last-child > div')
    expect((bars[0] as HTMLElement).style.width).toBe('100%')
    expect((bars[1] as HTMLElement).style.width).toBe('50%')
  })

  it('falls back to a neutral color when a category has none', () => {
    const { container } = render(CategoryBreakdownList, {
      data: [{ id: 1, name: 'Misc', color: null, total: 100 }],
    })
    const bar = container.querySelector('li > div:last-child > div') as HTMLElement
    expect(bar.style.backgroundColor).toBe('rgb(148, 163, 184)')
  })
})
