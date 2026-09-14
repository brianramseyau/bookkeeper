import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import LoadingSkeleton from './LoadingSkeleton.svelte'

describe('LoadingSkeleton', () => {
  it('renders an accessible loading status', () => {
    render(LoadingSkeleton)

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('renders 3 placeholder lines by default', () => {
    const { container } = render(LoadingSkeleton)

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(3)
  })

  it('renders the given number of placeholder lines', () => {
    const { container } = render(LoadingSkeleton, { rows: 5 })

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(5)
  })

  it('shortens the last line when there is more than one', () => {
    const { container } = render(LoadingSkeleton, { rows: 2 })

    const lines = container.querySelectorAll('[data-slot="skeleton"]')
    expect(lines[0]).toHaveClass('w-full')
    expect(lines[1]).toHaveClass('w-2/3')
  })

  it('keeps a single line full-width', () => {
    const { container } = render(LoadingSkeleton, { rows: 1 })

    expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass('w-full')
  })
})
