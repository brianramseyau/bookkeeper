import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// DESIGN.md's Quality floor requires axe-clean contrast in both themes.
// Phase 1 checked this against the dev-only `/_design` specimen; Phase 6
// retired that route, so the assertion now runs against the Dashboard - a
// live page carrying the month strip, money figures, chips and a chart in
// both themes, which is the surface a contrast regression would actually
// show up on.
for (const theme of ['light', 'dark'] as const) {
  test(`dashboard has no axe violations (${theme})`, async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /welcome, jordan/i })).toBeVisible()

    if (theme === 'dark') {
      // Reload rather than toggling the class live - colour/background
      // utilities using `transition-colors` were still mid-transition at
      // the instant a live toggle took its axe snapshot, which axe reported
      // as a real contrast failure using the blended, not the settled,
      // colour. A reload re-runs app.html's own pre-hydration bootstrap
      // script (reads localStorage, sets the class before anything paints),
      // so there's nothing to transition from - the same as a real user's
      // cold load in their persisted theme.
      await page.evaluate(() => localStorage.setItem('theme', 'dark'))
      await page.reload()
      await expect(page.getByRole('heading', { name: /welcome, jordan/i })).toBeVisible()
    }

    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
}
