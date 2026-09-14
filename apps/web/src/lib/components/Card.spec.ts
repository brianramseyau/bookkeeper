import { createRawSnippet } from 'svelte'
import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Card from './Card.svelte'

const childrenSnippet = createRawSnippet(() => ({
  render: () => '<p>content</p>',
}))

describe('Card', () => {
  it('renders its children inside the card wrapper', () => {
    const { getByText } = render(Card, { children: childrenSnippet })
    expect(getByText('content')).toBeInTheDocument()
  })

  it('applies the base card classes', () => {
    const { container } = render(Card, { children: childrenSnippet })
    const div = container.querySelector('div')
    expect(div?.className).toContain('rounded-xl')
    expect(div?.className).toContain('border-border')
    expect(div?.className).toContain('bg-card')
  })

  it('appends extra classes passed via the class prop', () => {
    const { container } = render(Card, {
      children: childrenSnippet,
      class: 'p-4 overflow-x-auto',
    })
    const div = container.querySelector('div')
    expect(div?.className).toContain('p-4')
    expect(div?.className).toContain('overflow-x-auto')
    expect(div?.className).toContain('rounded-xl')
  })

  it('renders as an anchor when href is provided', () => {
    const { container } = render(Card, { children: childrenSnippet, href: '/utilities/1' })
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('/utilities/1')
    expect(anchor?.className).toContain('rounded-xl')
    expect(container.querySelector('div')).toBeNull()
  })

  it('strips the card chrome on mobile when pivotTable is set', () => {
    const { container } = render(Card, { children: childrenSnippet, pivotTable: true })
    const div = container.querySelector('div')
    const classes = div?.className.split(/\s+/)
    expect(classes).toContain('bg-transparent')
    expect(classes).toContain('border-0')
    expect(classes).toContain('rounded-none')
    expect(classes).not.toContain('bg-card')
  })

  it('restores the card chrome at sm when pivotTable is set', () => {
    const { container } = render(Card, { children: childrenSnippet, pivotTable: true })
    const div = container.querySelector('div')
    const classes = div?.className.split(/\s+/)
    expect(classes).toContain('sm:bg-card')
    expect(classes).toContain('sm:border-border')
    expect(classes).toContain('sm:rounded-xl')
  })

  it('keeps the full card chrome at every size by default', () => {
    const { container } = render(Card, { children: childrenSnippet })
    const div = container.querySelector('div')
    const classes = div?.className.split(/\s+/)
    expect(classes).toContain('bg-card')
    expect(classes).not.toContain('bg-transparent')
  })
})
