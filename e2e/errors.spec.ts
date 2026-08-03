import { test, expect } from '@playwright/test'

test('shows the not-found page for an unknown route and links back to the dashboard', async ({
  page,
}) => {
  await page.goto('/this-page-does-not-exist')

  await expect(page).toHaveTitle(/Page not found/)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  await page.getByRole('link', { name: /back to dashboard/i }).click()
  await expect(page).toHaveURL('/')
})
