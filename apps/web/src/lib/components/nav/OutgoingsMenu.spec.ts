import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { page } from '$app/state'
import OutgoingsMenu from './OutgoingsMenu.svelte'

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }))

// See ActionMenu.spec.ts: bits-ui's floating (DropdownMenu) content stays
// `visibility: hidden` under jsdom, which breaks `getByRole(role, { name })`'s
// accessible-name computation - `getByText` is used instead for content
// inside an opened menu, since it matches raw text content rather than the
// accessibility tree and isn't affected by that.

function setPageUrl(url: string) {
  page.url = new URL(url) as unknown as typeof page.url
}

describe('OutgoingsMenu', () => {
  it('renders a Bills/Subscriptions/Expenses/Utilities link once opened', async () => {
    setPageUrl('http://localhost/monthly')
    const user = userEvent.setup()
    render(OutgoingsMenu)

    await user.click(screen.getByRole('button', { name: 'Outgoings' }))

    expect(screen.getByText('Bills').closest('a')).toHaveAttribute('href', '/bills')
    expect(screen.getByText('Subscriptions').closest('a')).toHaveAttribute('href', '/subscriptions')
    expect(screen.getByText('Expenses').closest('a')).toHaveAttribute('href', '/expenses')
    expect(screen.getByText('Utilities').closest('a')).toHaveAttribute('href', '/utilities')
  })

  it('is not active on a route outside the group', () => {
    setPageUrl('http://localhost/monthly')
    render(OutgoingsMenu)

    expect(screen.getByRole('button', { name: 'Outgoings' })).not.toHaveClass('text-violet')
  })

  it.each(['/bills', '/subscriptions', '/expenses', '/utilities'])('is active on %s', (path) => {
    setPageUrl(`http://localhost${path}`)
    render(OutgoingsMenu)

    expect(screen.getByRole('button', { name: 'Outgoings' })).toHaveClass('text-violet')
  })

  it('is not active on a route that merely shares a prefix', () => {
    // /bills-archive must not count as /bills - a raw `startsWith` would
    // get this wrong (see route-active.spec.ts for the unit-level case).
    setPageUrl('http://localhost/bills-archive')
    render(OutgoingsMenu)

    expect(screen.getByRole('button', { name: 'Outgoings' })).not.toHaveClass('text-violet')
  })

  it('marks the active trigger and menu item with aria-current', async () => {
    setPageUrl('http://localhost/bills')
    const user = userEvent.setup()
    render(OutgoingsMenu)

    expect(screen.getByRole('button', { name: 'Outgoings' })).toHaveAttribute(
      'aria-current',
      'true'
    )

    await user.click(screen.getByRole('button', { name: 'Outgoings' }))

    expect(screen.getByText('Bills').closest('a')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Subscriptions').closest('a')).not.toHaveAttribute('aria-current')
  })

  it('supports a custom trigger, receiving a props object to spread and the active flag', () => {
    // A `createRawSnippet` fixture can't wire up bits-ui's real onclick
    // handler onto its static markup, so it can only verify the *shape* of
    // what's passed through (a `{ props }` wrapper matching bits-ui's own
    // `child`-snippet contract, plus `active`) - not that clicking it opens
    // the menu. That's covered end-to-end by MobileTabBar.spec.ts, whose
    // custom triggers are real Svelte snippets that do spread `{...props}`
    // and are clicked to confirm the menu opens.
    setPageUrl('http://localhost/bills')
    const triggerSnippet = createRawSnippet<[{ props: Record<string, unknown> }, boolean]>(
      (propsArg, active) => ({
        render: () => {
          const { props } = propsArg()
          return `<button data-has-props="${'aria-haspopup' in props}" ${active() ? 'data-active' : ''}>Custom trigger</button>`
        },
      })
    )
    render(OutgoingsMenu, { trigger: triggerSnippet })

    const trigger = screen.getByRole('button', { name: 'Custom trigger' })
    expect(trigger).toHaveAttribute('data-active')
    expect(trigger).toHaveAttribute('data-has-props', 'true')
  })

  it('highlights the current route inside the menu', async () => {
    setPageUrl('http://localhost/bills')
    const user = userEvent.setup()
    render(OutgoingsMenu)

    await user.click(screen.getByRole('button', { name: 'Outgoings' }))

    expect(screen.getByText('Bills')).toHaveClass('text-violet')
    expect(screen.getByText('Subscriptions')).toHaveClass('text-ink')
  })

  it("keeps the vendored item's own interaction styling alongside the active-route colour", async () => {
    // Regression check for the `props.class` merge fix (see DESIGN.md's
    // decisions log) - `focus:bg-accent` etc. must survive alongside our
    // own colour, not be overwritten by it.
    setPageUrl('http://localhost/bills')
    const user = userEvent.setup()
    render(OutgoingsMenu)

    await user.click(screen.getByRole('button', { name: 'Outgoings' }))

    expect(screen.getByText('Bills')).toHaveClass('focus:bg-accent')
  })
})
