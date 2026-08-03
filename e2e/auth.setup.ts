import { test as setup, expect } from '@playwright/test'
import { JORDAN } from './credentials'

const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(JORDAN.email)
  await page.getByLabel('Password').fill(JORDAN.password)
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
  await page.context().storageState({ path: authFile })
})
