import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// DESIGN.md's Quality floor requires axe-clean contrast in both themes.
// Phase 1 checked this against the dev-only `/_design` specimen; Phase 6
// retired that route, so the assertion now sweeps every main route in both
// themes and both a desktop and a mobile viewport (the mobile pass is the
// only one that sees the bottom tab bar). `e2e/pages.spec.ts` already
// establishes each route's level-1 heading.
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

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844 },
]

const THEMES = ['light', 'dark'] as const

async function applyTheme(page: Page, theme: (typeof THEMES)[number]) {
  if (theme === 'light') return
  // Reload rather than toggling the class live - colour/background utilities
  // using `transition-colors` were still mid-transition at the instant a
  // live toggle took its axe snapshot, which axe reported as a real contrast
  // failure using the blended, not the settled, colour. A reload re-runs
  // app.html's own pre-hydration bootstrap script (reads localStorage, sets
  // the class before anything paints), so there's nothing to transition
  // from. Assert the class actually took so a renamed key can't silently
  // make this a second light run.
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
}

/** Navigate and wait until the route's data has settled, so axe can't scan
 *  the loading skeleton instead of the content it exists to check. */
async function loadRoute(page: Page, path: string, heading: string | RegExp) {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
}

/** Reveal the collapsed surfaces that hold colour that could drift: the
 *  MonthlyExpenseChart's table and Income's charts accordion. */
async function expandCollapsedContent(page: Page) {
  const viewTable = page.getByRole('button', { name: 'View as table' })
  if ((await viewTable.count()) > 0) {
    await viewTable.first().click()
    await expect(page.getByRole('button', { name: 'Hide table' }).first()).toBeVisible()
  }

  const charts = page.getByRole('button', { name: /^Charts/ })
  if ((await charts.count()) > 0) {
    await charts.first().click()
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
  }
}

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()

  expect(results.violations).toEqual([])
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    for (const { path, heading } of ROUTES) {
      test(`${path} has no axe violations (${theme}, ${viewport.name})`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await applyTheme(page, theme)
        await loadRoute(page, path, heading)
        await expandCollapsedContent(page)
        await expectAxeClean(page)
      })
    }
  }
}

// The list routes above are the sweep; a detail route is added so
// OutgoingDetail's own MonthlyExpenseChart and stat figures are in scope
// too. Desktop only - it shares the same chart component the mobile
// dashboard test already covers.
for (const theme of THEMES) {
  test(`/bills detail has no axe violations (${theme})`, async ({ page }) => {
    await applyTheme(page, theme)
    await loadRoute(page, '/bills', 'Bills')
    await page.locator('a[href^="/bills/"]').first().click()
    await page.waitForURL(/\/bills\/.+/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
    await expandCollapsedContent(page)
    await expectAxeClean(page)
  })
}
