import { test, expect, type Page } from '@playwright/test'

const user = { id: 'miniapp-user', username: 'dara', fullName: 'Dara Sok', email: 'dara@example.com', roles: ['USER'], enabled: true }
const tokens = { accessToken: 'miniapp-access', refreshToken: 'miniapp-refresh', tokenType: 'Bearer', expiresIn: 1800, user }

async function telegramSdk(page: Page) {
  await page.addInitScript(() => {
    const events: Record<string, (() => void)[]> = {}
    let back: (() => void) | undefined
    const bridge = {
      initData: 'signed-init-data-from-telegram', colorScheme: 'light' as 'light' | 'dark', themeParams: {},
      ready: () => {}, expand: () => {},
      onEvent: (event: string, handler: () => void) => { (events[event] ??= []).push(handler) },
      offEvent: (event: string, handler: () => void) => { events[event] = events[event]?.filter(item => item !== handler) ?? [] },
      BackButton: { show: () => {}, hide: () => {}, onClick: (handler: () => void) => { back = handler }, offClick: () => { back = undefined } },
      HapticFeedback: { selectionChanged: () => {} },
      setHeaderColor: () => {}, setBackgroundColor: () => {},
    }
    window.Telegram = { WebApp: bridge }
    Object.assign(window, {
      miniappTestBack: () => back?.(),
      miniappTestDark: () => { bridge.colorScheme = 'dark'; events.themeChanged?.forEach(handler => handler()) },
    })
    // An embedded launch must not restore a different cached account.
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem('expense-tracker.accessToken', 'stale-access')
      storage.setItem('expense-tracker.refreshToken', 'stale-refresh')
      storage.setItem('expense-tracker.user', JSON.stringify({ id: 'wrong-user', username: 'Wrong account', roles: ['SUPER_ADMIN'] }))
    }
  })
}

async function mockApi(page: Page, authStatus = 200) {
  const calls: string[] = []
  let linked = authStatus === 200
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    calls.push(path)
    if (path === '/api/v1/auth/telegram') {
      expect(request.postDataJSON()).toEqual({ initData: 'signed-init-data-from-telegram' })
      expect(request.headers().authorization).toBeUndefined()
      return route.fulfill(linked ? { json: { data: tokens } } : {
        status: authStatus, json: { code: 'FORBIDDEN', message: 'Connect Telegram to your expense-tracker account first.' },
      })
    }
    if (path === '/api/v1/auth/telegram/login') {
      expect(request.headers().authorization).toBeUndefined()
      expect(request.postDataJSON()).toEqual({ credentials: { username: 'dara', password: 'test-password' }, initData: 'signed-init-data-from-telegram' })
      linked = true
      return route.fulfill({ json: { data: tokens } })
    }
    if (path === '/api/v1/auth/telegram/register') {
      expect(request.headers().authorization).toBeUndefined()
      expect(request.postDataJSON()).toEqual({ account: { username: 'dara', email: 'dara@example.com', password: 'test-password' }, initData: 'signed-init-data-from-telegram' })
      linked = true
      return route.fulfill({ status: 201, json: { data: tokens } })
    }
    if (path === '/api/v1/auth/login') return route.fulfill({ json: { data: tokens } })
    expect(request.headers().authorization).toBe('Bearer miniapp-access')
    if (path.endsWith('/construction/access')) return route.fulfill({ json: { data: { allowed: false, siteIds: [] } } })
    if (path.endsWith('/reports/monthly')) return route.fulfill({ json: { data: [
      { currency: 'USD', totalIncome: 800, totalExpenses: 125.5, balance: 674.5, incomeCount: 2, expenseCount: 3 },
      { currency: 'KHR', totalIncome: 800000, totalExpenses: 150000, balance: 650000, incomeCount: 1, expenseCount: 2 },
    ] } })
    if (path.endsWith('/cash/balances')) return route.fulfill({ json: { data: [{ currency: 'USD', totalTopups: 100, totalSpent: 25, remainingAmount: 75 }] } })
    if (path.endsWith('/expenses/recent')) return route.fulfill({ json: { data: [
      { id: 'expense-1', description: 'Morning coffee', amount: 2.5, currency: 'USD', expenseDate: '2026-10-18', paymentMethod: 'CASH', category: { id: 'food', name: 'Food' } },
    ] } })
    if (path.endsWith('/expenses/totals')) return route.fulfill({ json: { data: [] } })
    if (path.endsWith('/telegram')) return route.fulfill({ json: { data: { available: true, connected: false } } })
    if (path.endsWith('/profile')) return route.fulfill({ json: { data: user } })
    return route.fulfill({ json: { data: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } })
  })
  return calls
}

test.use({ viewport: { width: 390, height: 844 } })

test('signs into the linked account, isolates sessions, and shows mobile balances', async ({ page }) => {
  await telegramSdk(page)
  const calls = await mockApi(page)
  await page.goto('/miniapp')
  await expect(page.getByRole('heading', { name: 'Hello, Dara' })).toBeVisible()
  await expect(page.getByLabel('Monthly balance')).toContainText('$674.50')
  await expect(page.getByText('Morning coffee')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Mini App navigation' })).toBeVisible()
  expect(calls.filter(path => path.endsWith('/auth/telegram'))).toHaveLength(1)
  const stored = await page.evaluate(() => ({
    embedded: sessionStorage.getItem('expense-tracker.accessToken'), desktop: localStorage.getItem('expense-tracker.accessToken'),
  }))
  expect(stored).toEqual({ embedded: 'miniapp-access', desktop: 'stale-access' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '../.release/telegram-miniapp-mobile.png', fullPage: true })
})

test('switches currencies, follows Telegram themes, and exposes role-appropriate features', async ({ page }) => {
  await telegramSdk(page); await mockApi(page)
  await page.goto('/miniapp')
  await page.getByRole('button', { name: 'KHR', exact: true }).click()
  await expect(page.getByLabel('Monthly balance')).toContainText('650,000')
  await page.evaluate(() => (window as unknown as { miniappTestDark: () => void }).miniappTestDark())
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Telegram connection' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Manage users' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Construction payments' })).toHaveCount(0)
})

test('opens the existing expense form and handles the native Telegram back button', async ({ page }) => {
  await telegramSdk(page); await mockApi(page)
  await page.goto('/miniapp')
  await page.getByRole('link', { name: 'Add expense', exact: true }).last().click()
  await expect(page.getByRole('dialog', { name: 'Add expense', exact: true })).toBeVisible()
  await page.evaluate(() => (window as unknown as { miniappTestBack: () => void }).miniappTestBack())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => (window as unknown as { miniappTestBack: () => void }).miniappTestBack())
  await expect(page.getByRole('heading', { name: 'Hello, Dara' })).toBeVisible()
})

test('automatically connects Telegram after one account sign-in and signs in on the next launch', async ({ page }) => {
  await telegramSdk(page)
  const calls = await mockApi(page, 403)
  await page.goto('/miniapp')
  await expect(page.getByText('Connect Telegram to your expense-tracker account first.')).toBeVisible()
  await expect(page.getByText('Wrong account')).toHaveCount(0)
  expect(calls.some(path => path.endsWith('/reports/monthly'))).toBe(false)
  await page.getByRole('button', { name: 'Sign in to an existing account' }).click()
  await page.getByLabel('Username or email').fill('dara')
  await page.getByLabel(/^Password/).fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hello, Dara' })).toBeVisible()
  expect(calls).toContain('/api/v1/auth/telegram/login')
  expect(calls).not.toContain('/api/v1/auth/login')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Hello, Dara' })).toBeVisible()
  expect(calls.filter(path => path === '/api/v1/auth/telegram')).toHaveLength(2)
})

test('automatically connects Telegram during registration inside the Mini App', async ({ page }) => {
  await telegramSdk(page)
  const calls = await mockApi(page, 403)
  await page.goto('/miniapp')
  await page.getByRole('button', { name: 'Sign in to an existing account' }).click()
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByLabel(/^Username/).fill('dara')
  await page.getByLabel(/^E-mail/).fill('dara@example.com')
  await page.getByLabel(/^Password/).fill('test-password')
  await page.getByLabel(/^Confirm password/).fill('test-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hello, Dara' })).toBeVisible()
  expect(calls).toContain('/api/v1/auth/telegram/register')
  expect(calls).not.toContain('/api/v1/auth/register')
})

test('supports browser preview without treating the preview flag as Telegram identity', async ({ page }) => {
  await page.route('https://telegram.org/js/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  const calls = await mockApi(page)
  await page.goto('/miniapp')
  await expect(page.getByRole('heading', { name: 'Your money. A little closer.' })).toBeVisible()
  expect(calls.filter(path => path.endsWith('/auth/telegram'))).toHaveLength(0)
  await page.getByRole('button', { name: 'Sign in to an existing account' }).click()
  await page.getByLabel('Username or email').fill('dara')
  await page.getByLabel(/^Password/).fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Hello, Dara' })).toBeVisible()
})

test('does not restore a cached account when the Telegram bridge fails to load', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('expense-tracker.accessToken', 'stale-access')
    sessionStorage.setItem('expense-tracker.refreshToken', 'stale-refresh')
    sessionStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'wrong', username: 'Wrong account', roles: ['USER'] }))
  })
  await page.route('https://telegram.org/js/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }))
  const calls = await mockApi(page)
  await page.goto('/miniapp#tgWebAppData=unavailable-launch-data')
  await expect(page.getByText(/Unable to read Telegram sign-in data/)).toBeVisible()
  await expect(page.getByText('Wrong account')).toHaveCount(0)
  expect(calls.some(path => path.endsWith('/reports/monthly'))).toBe(false)
})

test('opens the create menu from the bottom bar and starts expense entry', async ({ page }) => {
  await telegramSdk(page); await mockApi(page)
  await page.goto('/miniapp')
  const nav = page.getByRole('navigation', { name: 'Mini App navigation' })
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('button', { name: 'Create new entry' }).click()
  const create = page.getByRole('dialog', { name: 'Create', exact: true })
  await expect(create).toBeVisible()
  await page.screenshot({ path: '../.release/telegram-miniapp-create-menu.png', fullPage: true })
  await create.getByRole('link', { name: /Add expense/ }).click()
  await expect(create).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Add expense', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Expenses', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('closes create with Telegram back, offers income entry, and activates the profile tab', async ({ page }) => {
  await telegramSdk(page); await mockApi(page)
  await page.goto('/miniapp')
  const nav = page.getByRole('navigation', { name: 'Mini App navigation' })
  await nav.getByRole('button', { name: 'Create new entry' }).click()
  await page.evaluate(() => (window as unknown as { miniappTestBack: () => void }).miniappTestBack())
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await nav.getByRole('button', { name: 'Create new entry' }).click()
  await page.getByRole('dialog', { name: 'Create', exact: true }).getByRole('link', { name: /Add income/ }).click()
  await expect(page.getByRole('dialog', { name: 'Add income', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await nav.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(nav.getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).not.toHaveAttribute('aria-current', 'page')
})
