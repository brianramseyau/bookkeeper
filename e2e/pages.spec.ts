import { test, expect, type Page } from '@playwright/test'

const PAGES: { navLabel: string; path: string; heading: string | RegExp }[] = [
  { navLabel: 'Dashboard', path: '/', heading: /welcome/i },
  { navLabel: 'Monthly', path: '/monthly', heading: 'Monthly' },
  { navLabel: 'Income', path: '/income', heading: 'Income' },
  { navLabel: 'Utilities', path: '/utilities', heading: 'Utilities' },
  { navLabel: 'Bills', path: '/bills', heading: 'Bills' },
  { navLabel: 'Subscriptions', path: '/subscriptions', heading: 'Personal Subscriptions' },
  { navLabel: 'Expenses', path: '/expenses', heading: 'Expenses' },
  { navLabel: 'Categories', path: '/categories', heading: 'Categories' },
  { navLabel: 'Tasks', path: '/tasks', heading: 'Tasks' },
]

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

for (const { navLabel, path, heading } of PAGES) {
  test(`nav link "${navLabel}" loads ${path} without errors`, async ({ page }) => {
    const errors = trackConsoleErrors(page)

    await page.goto('/')
    await page.getByRole('link', { name: navLabel, exact: true }).first().click()

    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('settings page loads from the header link', async ({ page }) => {
  const errors = trackConsoleErrors(page)

  await page.goto('/')
  await page.getByRole('link', { name: /settings/i }).click()

  await expect(page).toHaveURL('/settings')
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  expect(errors).toEqual([])
})
