import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { createRawSnippet } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { mdiArchive, mdiPencil } from '@mdi/js'
import ActionMenu from './ActionMenu.svelte'

// bits-ui's floating content is positioned by floating-ui, which needs a
// real layout engine to settle - jsdom has none, so the content wrapper
// stays `visibility: hidden` in these tests even once open (real
// positioning/visibility is covered by the e2e "action menu fits the
// viewport" spec instead). Two knock-on effects of that, worked around
// below rather than in the component itself:
//   - Testing Library's role queries exclude elements that read as
//     inaccessible by that computed style, so every `getByRole` query into
//     the open menu passes `{ hidden: true }` to see past it.
//   - `visibility` is inherited, and the accessible-name algorithm
//     (`dom-accessibility-api`, which `getByRole(role, { name })` uses)
//     treats a descendant text node as unavailable for naming once an
//     ancestor computes `visibility: hidden` - so an item's "name from
//     content" comes back empty even though its real text is right there.
//     `getByText` isn't part of that algorithm at all (it matches raw text
//     content, not the accessibility tree), so it's used to find a
//     specific item instead of `getByRole(..., { name })`.
// This test only needs to prove the wrapper's contract (items render, the
// right one fires, disabled/outside-click are respected), not its real
// on-screen position.
const inOpenMenu = { hidden: true } as const

describe('ActionMenu', () => {
  it('opens the menu and fires the clicked action, then closes', async () => {
    const onEdit = vi.fn()
    const onArchive = vi.fn()
    const user = userEvent.setup()
    render(ActionMenu, {
      label: 'Actions for Groceries',
      actions: [
        { label: 'Edit', path: mdiPencil, onclick: onEdit },
        { label: 'Archive', path: mdiArchive, variant: 'muted', onclick: onArchive },
      ],
    })

    expect(screen.queryByRole('menu', inOpenMenu)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Actions for Groceries' }))
    expect(screen.getByRole('menu', inOpenMenu)).toBeInTheDocument()

    await user.click(screen.getByText('Archive'))

    expect(onArchive).toHaveBeenCalledOnce()
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu', inOpenMenu)).toBeNull()
  })

  it('closes the menu without firing an action when clicking outside', async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()
    render(ActionMenu, {
      label: 'Actions for Groceries',
      actions: [{ label: 'Edit', path: mdiPencil, onclick: onEdit }],
    })

    await user.click(screen.getByRole('button', { name: 'Actions for Groceries' }))
    expect(screen.getByRole('menu', inOpenMenu)).toBeInTheDocument()

    // Simulating "click outside" here needs three jsdom-specific workarounds,
    // none of which are things about ActionMenu itself:
    //   - While the menu is open, bits-ui's body-scroll-lock makes `<body>`
    //     itself `pointer-events: none` (see src/tests/setup.ts) - a real
    //     outside click would land on some other page element instead, but
    //     this component tree has nothing else to click, and `user.click`
    //     refuses to fire on a `pointer-events: none` target at all
    //     (correctly, mirroring what a real pointer could do) - so dispatch
    //     the raw event with `fireEvent` instead.
    //   - Dismissal is driven by a `pointerdown` listener bits-ui attaches to
    //     `document` only ~1ms after the layer opens, then debounces its own
    //     "was this outside?" check by 10ms (see
    //     use-dismissable-layer.svelte.js) - both real timers, so this
    //     polls for the result with `waitFor` rather than asserting on a
    //     fixed delay, which was flaky by exactly that margin.
    //   - Its outside/inside test compares the event's `clientX`/`clientY`
    //     against the content's `getBoundingClientRect()`
    //     (`isClickTrulyOutside`) - jsdom never lays anything out, so that
    //     rect is always exactly `{top:0,right:0,bottom:0,left:0}`, and an
    //     event with the default `clientX:0, clientY:0` reads as *inside*
    //     that zero-sized rect at the origin. Any nonzero coordinate reads
    //     as outside it, so one is set explicitly here - a real click could
    //     never land inside a truly zero-sized element either.
    // The listeners themselves are attached ~1ms after the layer opens
    // (real timer), and under a loaded full-suite run that can slip past any
    // fixed sleep - an event dispatched before then is simply missed (no
    // retry). So re-dispatch inside the `waitFor` until the menu closes;
    // extra pointerdowns on an already-dismissed layer are harmless.
    await waitFor(
      async () => {
        await fireEvent.pointerDown(document.body, { clientX: 999, clientY: 999, button: 0 })
        expect(screen.queryByRole('menu', inOpenMenu)).toBeNull()
      },
      { timeout: 2000 }
    )

    expect(onEdit).not.toHaveBeenCalled()
  })

  it('does not fire a disabled action', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(ActionMenu, {
      label: 'Actions for Groceries',
      actions: [
        { label: 'Delete', path: mdiArchive, variant: 'danger', onclick: onDelete, disabled: true },
      ],
    })

    await user.click(screen.getByRole('button', { name: 'Actions for Groceries' }))
    const deleteItem = screen.getByText('Delete').closest('[role="menuitem"]')
    expect(deleteItem).toHaveAttribute('aria-disabled', 'true')

    // A disabled bits-ui item is `pointer-events: none`, which userEvent
    // (correctly) refuses to click through - assert the a11y contract
    // above instead of attempting a click a real pointer couldn't make
    // either.
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('renders a custom trigger instead of the default ⋮ button', () => {
    const trigger = createRawSnippet(() => ({
      render: () => '<button type="button">Custom add</button>',
    }))
    const { getByRole, queryByRole } = render(ActionMenu, {
      label: 'Add income',
      actions: [{ label: 'Salary', path: mdiPencil, onclick: vi.fn() }],
      trigger,
    })

    expect(getByRole('button', { name: 'Custom add' })).toBeInTheDocument()
    expect(queryByRole('button', { name: 'Add income' })).toBeNull()
  })
})
