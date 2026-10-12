import { expect, test } from '@playwright/test'

test('validates fields and toggles password visibility without submitting', async ({ page }) => {
  let loginRequests = 0
  await page.route('**/api/v1/auth/login', async route => {
    loginRequests++
    await route.fulfill({ status: 401, json: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } })
  })
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Username is required', { exact: true })).toBeVisible()
  await expect(page.getByText('Password is required', { exact: true })).toBeVisible()
  await page.getByLabel('Username or e-mail', { exact: true }).fill('preview-user')
  await page.getByLabel('Password', { exact: true }).fill('preview-password')
  await page.getByRole('button', { name: 'Show password', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('preview-password')
  await page.getByRole('button', { name: 'Hide password', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
  expect(loginRequests).toBe(0)
})

test('handles rejected credentials, prevents duplicate submissions, and restores the requested route', async ({ page }) => {
  let attempts = 0
  let finishLogin: (() => void) | undefined
  await page.route('**/api/v1/**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/auth/login')) {
      expect(route.request().postDataJSON()).toEqual({ username: 'preview-user', password: 'preview-password' })
      attempts++
      if (attempts === 1) {
        await route.fulfill({ status: 401, json: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } })
      } else {
        await new Promise<void>(resolve => { finishLogin = resolve })
        await route.fulfill({ json: { data: { accessToken: 'simulated-access', refreshToken: 'simulated-refresh',
          user: { id: 'preview-user', username: 'preview-user', enabled: true, roles: ['USER'] } } } })
      }
    } else await route.fulfill({ json: { data: [], totalElements: 0, totalPages: 0, page: 0, size: 20 } })
  })
  await page.goto('/expenses')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('Username or e-mail').fill('  preview-user  ')
  await page.getByLabel('Password', { exact: true }).fill('preview-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid username or password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Signing in…', exact: true })).toBeDisabled()
  await expect.poll(() => Boolean(finishLogin)).toBe(true)
  finishLogin!()
  await expect(page).toHaveURL(/\/expenses$/)
  expect(attempts).toBe(2)
})

test('renders desktop light and dark layouts without browser errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.locator('.auth-hero')).toBeVisible()
  await page.screenshot({ path: '../backend/target/login-modern-light.png', fullPage: true })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByLabel('Password', { exact: true })).toHaveCSS('background-color', 'rgba(15, 25, 43, 0.65)')
  await page.screenshot({ path: '../backend/target/login-modern-dark.png', fullPage: true })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(errors).toEqual([])
})

test('keeps the mobile form usable in Khmer and registration reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByLabel('Language', { exact: true }).selectOption('km')
  await expect(page.locator('html')).toHaveAttribute('lang', 'km')
  await expect(page.locator('.auth-hero')).toBeHidden()
  await expect(page.locator('#login-password')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '../backend/target/login-modern-mobile-km.png', fullPage: true })
  await page.getByRole('link', { name: 'បង្កើតគណនី', exact: true }).click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: 'បង្កើតគណនីរបស់អ្នក' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
