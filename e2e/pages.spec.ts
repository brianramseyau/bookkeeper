import { test, expect, type Page } from '@playwright/test'

// Dashboard, Monthly and Income are direct top-nav links. Everything else
// now sits behind a dropdown - Bills/Subscriptions/Expenses/Utilities
// behind "Outgoings" (DESIGN.md groups them as the one "what do we pay
// for?" question), Categories/Tasks/Settings behind the account menu (see
// Phase 2's app-shell rework, foundational/PLAN_01_PHASE_02_APP_SHELL.md).
const DIRECT_PAGES: { navLabel: string; path: string; heading: string | RegExp }[] = [
  { navLabel: 'Dashboard', path: '/', heading: /welcome/i },
  { navLabel: 'Monthly', path: '/monthly', heading: 'Monthly' },
  { navLabel: 'Income', path: '/income', heading: 'Income' },
]

const OUTGOINGS_PAGES: { navLabel: string; path: string; heading: string | RegExp }[] = [
  { navLabel: 'Utilities', path: '/utilities', heading: 'Utilities' },
  { navLabel: 'Bills', path: '/bills', heading: 'Bills' },
  { navLabel: 'Subscriptions', path: '/subscriptions', heading: 'Subscriptions' },
  { navLabel: 'Expenses', path: '/expenses', heading: 'Expenses' },
]

const ACCOUNT_PAGES: { navLabel: string; path: string; heading: string | RegExp }[] = [
  { navLabel: 'Categories', path: '/categories', heading: 'Categories' },
  { navLabel: 'Tasks', path: '/tasks', heading: 'Tasks' },
  { navLabel: 'Settings', path: '/settings', heading: 'Settings' },
]

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

for (const { navLabel, path, heading } of DIRECT_PAGES) {
  test(`nav link "${navLabel}" loads ${path} without errors`, async ({ page }) => {
    const errors = trackConsoleErrors(page)

    await page.goto('/')
    await page.getByRole('link', { name: navLabel, exact: true }).first().click()

    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    expect(errors).toEqual([])
  })
}

for (const { navLabel, path, heading } of OUTGOINGS_PAGES) {
  test(`Outgoings menu link "${navLabel}" loads ${path} without errors`, async ({ page }) => {
    const errors = trackConsoleErrors(page)

    await page.goto('/')
    await page.getByRole('button', { name: 'Outgoings' }).click()
    await page.getByRole('menuitem', { name: navLabel }).click()

    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    expect(errors).toEqual([])
  })
}

for (const { navLabel, path, heading } of ACCOUNT_PAGES) {
  test(`Account menu link "${navLabel}" loads ${path} without errors`, async ({ page }) => {
    const errors = trackConsoleErrors(page)

    await page.goto('/')
    await page.getByRole('button', { name: /^Account menu for/ }).click()
    await page.getByRole('menuitem', { name: navLabel }).click()

    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    expect(errors).toEqual([])
  })
}
