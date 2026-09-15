import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// DESIGN.md's Quality floor requires axe-clean contrast in both themes.
// Phase 1 checked this against the dev-only `/_design` specimen; Phase 6
// retired that route, so the assertion now sweeps every main route instead
// of a single page - real content, real chrome (nav, bottom tab bar,
// toaster), both themes. `e2e/pages.spec.ts` already establishes each
// route's level-1 heading.
const ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: '/', heading: /welcome, jordan/i },
  { path: '/monthly', heading: 'Monthly' },
  { path: '/income', heading: 'Income' },
  { path: '/bills', heading: 'Bills' },
  { path: '/subscriptions', heading: 'Subscriptions' },
  { path: '/expenses', heading: 'Expenses' },
  { path: '/utilities', heading: 'Utilities' },
  { path: '/categories', heading: 'Categories' },
  { path: '/tasks', heading: 'Tasks' },
  { path: '/settings', heading: 'Settings' },
]

for (const theme of ['light', 'dark'] as const) {
  for (const { path, heading } of ROUTES) {
    test(`${path} has no axe violations (${theme})`, async ({ page }) => {
      if (theme === 'dark') {
        // Reload rather than toggling the class live - colour/background
        // utilities using `transition-colors` were still mid-transition at
        // the instant a live toggle took its axe snapshot, which axe reported
        // as a real contrast failure using the blended, not the settled,
        // colour. A reload re-runs app.html's own pre-hydration bootstrap
        // script (reads localStorage, sets the class before anything paints),
        // so there's nothing to transition from - the same as a real user's
        // cold load in their persisted theme. Assert the class actually took
        // so a renamed key can't silently make this a second light run.
        await page.goto('/')
        await page.evaluate(() => localStorage.setItem('theme', 'dark'))
        await page.reload()
        await expect(page.locator('html')).toHaveClass(/dark/)
      }

      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()

      // MonthlyExpenseChart mounts its table only when this toggle is on -
      // click it so the migrated table cells are in scope too.
      const viewTable = page.getByRole('button', { name: 'View as table' })
      if ((await viewTable.count()) > 0) {
        await viewTable.first().click()
        await expect(page.getByRole('button', { name: 'Hide table' }).first()).toBeVisible()
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()

      expect(results.violations).toEqual([])
    })
  }
}
