import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Phase 1's dev-only /_design specimen route (tokens, type, primitives) -
// checked here for the phase's own "axe is clean on /_design in both
// themes" acceptance criterion. Removed alongside the route itself in
// Phase 6 (see foundational/PLAN_01_PHASE_06_DOCS_CLEANUP.md).
for (const theme of ['light', 'dark'] as const) {
  test(`/_design has no axe violations (${theme})`, async ({ page }) => {
    await page.goto('/_design')
    await page.getByRole('heading', { name: 'Design specimen', level: 1 }).waitFor()

    if (theme === 'dark') {
      // Reload rather than just toggling the class live - color/background
      // utilities using `transition-colors` were still mid-transition at
      // the instant a live toggle took its axe snapshot, which axe reported
      // as a real contrast failure using the blended, not the settled,
      // colour. A reload re-runs app.html's own pre-hydration bootstrap
      // script (reads localStorage, sets the class before anything paints),
      // so there's nothing to transition from - the same as a real user's
      // cold load in their persisted theme.
      await page.evaluate(() => localStorage.setItem('theme', 'dark'))
      await page.reload()
      await page.getByRole('heading', { name: 'Design specimen', level: 1 }).waitFor()
    }

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
}
