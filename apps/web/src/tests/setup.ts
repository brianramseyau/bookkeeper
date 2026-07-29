import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// jsdom doesn't implement scrollIntoView at all (not even a no-op stub),
// which throws in any test that exercises hash-anchor scrolling (see
// routes/bills/+page.svelte's load()).
Element.prototype.scrollIntoView = vi.fn()

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
