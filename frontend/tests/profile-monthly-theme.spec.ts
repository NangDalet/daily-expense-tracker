import { expect, test, type Page } from '@playwright/test'

const initialUser = { id: 'test-user', username: 'nang', fullName: 'Nang Dalet', email: 'nang@example.com', roles: ['USER'], enabled: true }
async function session(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-10T05:00:00Z'))
  await page.emulateMedia({ colorScheme: 'light' })
  await page.addInitScript((user) => {
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify(user))
  }, initialUser)
}

async function reports(page: Page) {
  await page.route('**/api/v1/reports/monthly**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer test-access')
    const url = new URL(route.request().url())
    expect(url.searchParams.get('year')).toBe('2026')
    const rows = url.searchParams.get('month') === '10' ? [
      { currency: 'USD', totalIncome: 1000.30, totalExpenses: 88.48, balance: 911.82, incomeCount: 2, expenseCount: 3 },
      { currency: 'KHR', totalIncome: 10000, totalExpenses: 4500, balance: 5500, incomeCount: 1, expenseCount: 1 },
    ] : []
    await route.fulfill({ json: { data: rows } })
  })
}

test('monthly totals keep currencies separate and calculate planning amounts exactly', async ({ page }) => {
  await session(page); await reports(page)
  await page.goto('/monthly')
  await expect(page.getByLabel('Month', { exact: true })).toHaveValue('2026-10')
  await expect(page.getByText('$1,000.30', { exact: true })).toBeVisible()
  await expect(page.getByText('$88.48', { exact: true })).toBeVisible()
  await expect(page.getByText('$911.82', { exact: true })).toBeVisible()
  await page.getByLabel('Planned income (USD)', { exact: true }).fill('0.30')
  await page.getByLabel('Planned expenses (USD)', { exact: true }).fill('0.20')
  await expect(page.getByText('$0.10', { exact: true })).toBeVisible()
  await page.getByLabel('Currency', { exact: true }).selectOption('KHR')
  await expect(page.getByText('$911.82', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/4[,.]500/)).toBeVisible()
  await expect(page.getByLabel('Planned income (KHR)', { exact: true })).toHaveValue('')
  await page.getByLabel('Month', { exact: true }).fill('2026-09')
  await expect(page.getByText('No KHR income or expenses recorded for this month.')).toBeVisible()
})

test('dark mode changes the actual page colors and persists across reloads', async ({ page }) => {
  await session(page); await reports(page)
  await page.goto('/monthly')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(11, 18, 32)')
  expect(await page.locator('.card').first().evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(22, 34, 53)')
  await page.screenshot({ path: '../backend/target/monthly-dark-preview.png', fullPage: true })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('profile updates and cropped photos refresh the avatar without losing unsaved edits', async ({ page }) => {
  await session(page)
  let user: typeof initialUser & { avatarUrl?: string | null } = { ...initialUser }
  let submittedPhoto = ''
  await page.route('**/api/v1/profile**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer test-access')
    const request = route.request()
    if (request.method() === 'PUT' && request.url().endsWith('/photo')) {
      submittedPhoto = request.postDataJSON().imageData
      expect(submittedPhoto).toMatch(/^data:image\/jpeg;base64,/)
      expect(submittedPhoto.length).toBeLessThan(350000)
      user = { ...user, avatarUrl: submittedPhoto }
    } else if (request.method() === 'DELETE') user = { ...user, avatarUrl: null }
    else if (request.method() === 'PUT') {
      expect(Object.keys(request.postDataJSON()).sort()).toEqual(['email', 'fullName', 'username'])
      user = { ...user, ...request.postDataJSON() }
    }
    await route.fulfill({ json: { data: user } })
  })
  await page.goto('/profile')
  await expect(page.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  await page.getByLabel('Full name', { exact: true }).fill('Lyza')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#4f46e5'; ctx.fillRect(0, 0, 200, 200)
    ctx.fillStyle = '#22c55e'; ctx.fillRect(200, 0, 200, 200)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('Upload profile photo').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByAltText('Profile photo crop preview')).toBeVisible()
  await page.getByLabel('Zoom', { exact: true }).fill('2')
  await page.getByLabel('Horizontal position', { exact: true }).fill('100')
  await page.getByRole('button', { name: 'Save photo', exact: true }).click()
  await expect(page.getByText('Your profile photo has been saved.')).toBeVisible()
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Lyza')
  await expect(page.locator('aside img')).toHaveAttribute('src', submittedPhoto)
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByText('Your profile has been saved.')).toBeVisible()
  await expect(page.locator('aside').getByText('Lyza', { exact: true })).toBeVisible()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('expense-tracker.user')!))
  expect(stored.fullName).toBe('Lyza'); expect(stored.avatarUrl).toBe(submittedPhoto)
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click()
  await expect(page.getByText('Your profile photo has been removed.')).toBeVisible()
  await expect(page.locator('aside img')).toHaveCount(0)
})

test('profile rejects unsupported images and reports server validation errors', async ({ page }) => {
  await session(page)
  await page.route('**/api/v1/profile', async (route) => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 409, json: { code: 'DUPLICATE_RESOURCE', message: 'Email already belongs to another account' } })
    else await route.fulfill({ json: { data: initialUser } })
  })
  await page.goto('/profile')
  await expect(page.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  await page.getByLabel('Upload profile photo').setInputFiles({ name: 'avatar.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(page.getByText('Choose a JPEG, PNG, or WebP photo.')).toBeVisible()
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByText('Email already belongs to another account')).toBeVisible()
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Nang Dalet')
})

test('failed monthly reports do not display misleading zero totals', async ({ page }) => {
  await session(page)
  await page.route('**/api/v1/reports/monthly**', async (route) => {
    await route.fulfill({ status: 403, json: { code: 'FORBIDDEN', message: 'Could not load monthly totals' } })
  })
  await page.goto('/monthly')
  await expect(page.getByText('Could not load monthly totals')).toBeVisible()
  await expect(page.getByText('—', { exact: true })).toHaveCount(3)
})
