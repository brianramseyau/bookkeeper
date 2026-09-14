import { mdiPencil } from '@mdi/js'
import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import IconActionButton from './IconActionButton.svelte'

describe('IconActionButton', () => {
  it('fires onclick when clicked', async () => {
    const onclick = vi.fn()
    const { container } = render(IconActionButton, { label: 'Edit', path: mdiPencil, onclick })
    await fireEvent.click(container.querySelector('button')!)
    expect(onclick).toHaveBeenCalled()
  })

  it('sets the accessible name and tooltip from label', () => {
    const { container } = render(IconActionButton, {
      label: 'Edit Groceries',
      path: mdiPencil,
      onclick: vi.fn(),
    })
    const button = container.querySelector('button')!
    expect(button.getAttribute('aria-label')).toBe('Edit Groceries')
    expect(button.getAttribute('title')).toBe('Edit Groceries')
  })

  it('renders the given icon path', () => {
    const { container } = render(IconActionButton, {
      label: 'Edit',
      path: mdiPencil,
      onclick: vi.fn(),
    })
    expect(container.querySelector('path')?.getAttribute('d')).toBe(mdiPencil)
  })

  it('defaults to the neutral variant', () => {
    const { container } = render(IconActionButton, {
      label: 'Edit',
      path: mdiPencil,
      onclick: vi.fn(),
    })
    // Not hover:text-primary - DESIGN.md reserves violet for interactive
    // elements specifically (buttons, links, focus, selection), not as a
    // generic hover accent on every icon action. A plain "Edit" hovers to
    // ink, same as cancel/muted; only the semantic variants (primary,
    // danger, amber, success) get a Polymer colour.
    expect(container.querySelector('button')?.className).toContain('hover:text-foreground')
  })

  it.each([
    ['danger', 'hover:text-destructive'],
    ['primary', 'text-primary'],
    ['cancel', 'hover:text-foreground'],
    ['amber', 'hover:text-due'],
    ['muted', 'hover:text-foreground'],
    ['success', 'hover:text-in'],
  ] as const)('applies the %s variant classes', (variant, expectedClass) => {
    const { container } = render(IconActionButton, {
      label: 'Edit',
      path: mdiPencil,
      onclick: vi.fn(),
      variant,
    })
    expect(container.querySelector('button')?.className).toContain(expectedClass)
  })

  it('disables the button when disabled is true', () => {
    const { container } = render(IconActionButton, {
      label: 'Edit',
      path: mdiPencil,
      onclick: vi.fn(),
      disabled: true,
    })
    expect(container.querySelector('button')?.disabled).toBe(true)
  })

  it('appends extra classes', () => {
    const { container } = render(IconActionButton, {
      label: 'Edit',
      path: mdiPencil,
      onclick: vi.fn(),
      class: 'ml-1',
    })
    expect(container.querySelector('button')?.className).toContain('ml-1')
  })
})
