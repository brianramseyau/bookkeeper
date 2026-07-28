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
    expect(div?.className).toContain('border-slate-200')
    expect(div?.className).toContain('dark:bg-slate-800')
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
})
