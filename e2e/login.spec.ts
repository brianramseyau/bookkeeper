import { test, expect } from '@playwright/test'
import { JORDAN } from './credentials'

// Start every test in this file logged out, regardless of the shared
// authenticated storage state the other specs use.
test.use({ storageState: { cookies: [], origins: [] } })

test('redirects an unauthenticated visitor to the login page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('heading', { name: 'Bookkeeper' })).toBeVisible()
})

test('logs in with valid credentials and reaches the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(JORDAN.email)
  await page.getByLabel('Password').fill(JORDAN.password)
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: /welcome, jordan/i })).toBeVisible()
})

test('shows an error and stays on the login page for invalid credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(JORDAN.email)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page.getByText(/invalid|incorrect|credentials/i)).toBeVisible()
  await expect(page).toHaveURL('/login')
})
