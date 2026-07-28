import { createRawSnippet } from 'svelte'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import TextActionButton from './TextActionButton.svelte'

const label = createRawSnippet(() => ({
  render: () => '<span>Edit</span>',
}))

describe('TextActionButton', () => {
  it('fires onclick when clicked', async () => {
    const onclick = vi.fn()
    const { container } = render(TextActionButton, { children: label, onclick })
    await fireEvent.click(container.querySelector('button')!)
    expect(onclick).toHaveBeenCalled()
  })

  it('defaults to the neutral variant', () => {
    const { container } = render(TextActionButton, { children: label, onclick: vi.fn() })
    expect(container.querySelector('button')?.className).toContain('hover:text-indigo-600')
  })

  it.each([
    ['danger', 'hover:text-red-600'],
    ['primary', 'hover:text-indigo-700'],
    ['cancel', 'hover:text-slate-600'],
    ['amber', 'hover:text-amber-600'],
    ['muted', 'hover:text-slate-700'],
    ['success', 'hover:text-emerald-600'],
  ] as const)('applies the %s variant classes', (variant, expectedClass) => {
    const { container } = render(TextActionButton, { children: label, onclick: vi.fn(), variant })
    expect(container.querySelector('button')?.className).toContain(expectedClass)
  })

  it('disables the button when disabled is true', () => {
    const { container } = render(TextActionButton, {
      children: label,
      onclick: vi.fn(),
      disabled: true,
    })
    expect(container.querySelector('button')?.disabled).toBe(true)
  })

  it('appends extra classes', () => {
    const { container } = render(TextActionButton, {
      children: label,
      onclick: vi.fn(),
      class: '-my-1 ml-1 p-1',
    })
    expect(container.querySelector('button')?.className).toContain('ml-1')
  })
})
