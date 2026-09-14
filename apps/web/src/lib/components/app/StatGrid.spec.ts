import { render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import StatGrid from './StatGrid.svelte'

const childrenSnippet = createRawSnippet(() => ({
  render: () => '<p>a card</p>',
}))

describe('StatGrid', () => {
  it('renders its children', () => {
    render(StatGrid, { children: childrenSnippet })

    expect(screen.getByText('a card')).toBeInTheDocument()
  })

  it('defaults to a 3-column grid at sm', () => {
    const { container } = render(StatGrid, { children: childrenSnippet })

    expect(container.firstElementChild).toHaveClass('sm:grid-cols-3')
  })

  it('supports a 2-column grid', () => {
    const { container } = render(StatGrid, { children: childrenSnippet, cols: 2 })

    expect(container.firstElementChild).toHaveClass('sm:grid-cols-2')
  })

  it('supports a 4-column grid that steps through 2 columns at sm', () => {
    const { container } = render(StatGrid, { children: childrenSnippet, cols: 4 })

    expect(container.firstElementChild).toHaveClass('sm:grid-cols-2', 'lg:grid-cols-4')
  })

  it('is a single column below sm', () => {
    const { container } = render(StatGrid, { children: childrenSnippet })

    expect(container.firstElementChild).toHaveClass('grid-cols-1')
  })
})
