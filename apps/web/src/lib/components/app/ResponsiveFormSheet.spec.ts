import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import ResponsiveFormSheet from './ResponsiveFormSheet.svelte'

// jsdom's window.matchMedia is stubbed to always report "no match" (see
// src/tests/setup.ts) - that's the mobile/Drawer branch. A test that needs
// the desktop/Sheet branch overrides it before rendering, since
// ResponsiveFormSheet's `MediaQuery` reads window.matchMedia once at
// construction, not reactively per-test.
function mockDesktop() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(), // deprecated, but still part of MediaQueryList's type
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) satisfies MediaQueryList
  )
}

const childrenSnippet = createRawSnippet(() => ({
  render: () => '<label>Name <input /></label>',
}))
const footerSnippet = createRawSnippet(() => ({
  render: () => '<button type="button">Save</button>',
}))

describe('ResponsiveFormSheet', () => {
  it('renders nothing when closed', () => {
    render(ResponsiveFormSheet, {
      open: false,
      onOpenChange: vi.fn(),
      title: 'Add bill',
      children: childrenSnippet,
    })

    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull()
  })

  it('renders as a drawer below sm, with the title, body and footer', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(ResponsiveFormSheet, {
      open: true,
      onOpenChange,
      title: 'Add bill',
      description: 'Log a new recurring bill.',
      children: childrenSnippet,
      footer: footerSnippet,
    })

    // Asserting the vendored wrapper's own slot, not just the shared
    // title/body/footer content every branch renders - a broken or
    // inverted `isDesktop` check must fail this, not just look identical.
    expect(document.querySelector('[data-slot="drawer-content"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="sheet-content"]')).toBeNull()
    expect(screen.getByText('Add bill')).toBeInTheDocument()
    expect(screen.getByText('Log a new recurring bill.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders as a sheet at sm and up', async () => {
    mockDesktop()
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(ResponsiveFormSheet, {
      open: true,
      onOpenChange,
      title: 'Add bill',
      children: childrenSnippet,
    })

    expect(document.querySelector('[data-slot="sheet-content"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeNull()
    expect(screen.getByText('Add bill')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
