import { createRawSnippet } from 'svelte'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SecondaryButton from './SecondaryButton.svelte'

const label = createRawSnippet(() => ({
  render: () => '<span>Save</span>',
}))

describe('SecondaryButton', () => {
  it('renders a submit button by default type when specified', () => {
    const { container } = render(SecondaryButton, { children: label, type: 'submit' })
    expect(container.querySelector('button')?.getAttribute('type')).toBe('submit')
  })

  it('defaults to type="button"', () => {
    const { container } = render(SecondaryButton, { children: label })
    expect(container.querySelector('button')?.getAttribute('type')).toBe('button')
  })

  it('fires onclick when clicked', async () => {
    const onclick = vi.fn()
    const { container } = render(SecondaryButton, { children: label, onclick })
    await fireEvent.click(container.querySelector('button')!)
    expect(onclick).toHaveBeenCalled()
  })

  it('disables the button when disabled is true', () => {
    const { container } = render(SecondaryButton, { children: label, disabled: true })
    expect(container.querySelector('button')?.disabled).toBe(true)
  })

  it('renders as an anchor when href is provided', () => {
    const { container } = render(SecondaryButton, { children: label, href: '/recurring-bills' })
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('/recurring-bills')
    expect(container.querySelector('button')).toBeNull()
  })

  it('applies the size classes', () => {
    const { container } = render(SecondaryButton, { children: label, size: 'lg' })
    expect(container.querySelector('button')?.className).toContain('py-2')
  })

  it('appends extra classes', () => {
    const { container } = render(SecondaryButton, { children: label, class: 'mt-3' })
    expect(container.querySelector('button')?.className).toContain('mt-3')
  })
})
