import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// jsdom doesn't implement scrollIntoView at all (not even a no-op stub),
// which throws in any test that exercises hash-anchor scrolling (see
// routes/bills/+page.svelte's load()).
Element.prototype.scrollIntoView = vi.fn()

// jsdom doesn't implement window.matchMedia at all either, which throws in
// any test that mounts a component using Svelte's built-in `MediaQuery`
// (svelte/reactivity) - e.g. ResponsiveFormSheet choosing between a Sheet
// and a Drawer by viewport width. Defaults to "no match" (the mobile/Drawer
// branch); a test that cares which branch renders overrides this per-test
// with `vi.spyOn(window, 'matchMedia')`.
window.matchMedia =
  window.matchMedia ||
  vi.fn().mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(), // deprecated, but still part of MediaQueryList's type
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) satisfies MediaQueryList
  )

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()

  // bits-ui's body-scroll-lock (any open Popover/DropdownMenu/Dialog/Sheet)
  // resets `<body>`'s inline style via a real `window.setTimeout` (~24ms,
  // scheduled on close/unmount - see body-scroll-lock.svelte.js) rather than
  // synchronously, so it doesn't fire before a test's own assertions run.
  // Without this, a test that closes one of those components leaves
  // `document.body.style.pointerEvents = 'none'` in place for the next
  // test in the same file - and since `pointer-events` is inherited, every
  // element in that next test's tree (including its own trigger button)
  // silently inherits it, so userEvent's click refuses to fire on an
  // otherwise-correct trigger. Force the reset between tests instead of
  // waiting on that timer.
  document.body.removeAttribute('style')

  // bits-ui tracks every open Popover/DropdownMenu/Dialog/Sheet's outside-
  // click handling in a `Map` on `globalThis` (`bitsDismissableLayers`,
  // see use-dismissable-layer.svelte.js) shared across the whole test
  // file, not scoped per component instance. Each layer removes its own
  // entry on unmount, but a stale one from an already-unmounted layer in
  // an earlier test can still shift which layer the "am I the responsible
  // (topmost) one?" check picks for the next test's outside click, making
  // it a no-op there instead. Clearing it is a no-op for a real app (there
  // it's rebuilt from whatever's actually mounted) - it only matters
  // between isolated test renders.
  const dismissableLayers = (globalThis as { bitsDismissableLayers?: Map<unknown, unknown> })
    .bitsDismissableLayers
  dismissableLayers?.clear()
})
