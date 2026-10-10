import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'test-user', username: 'user', email: 'user@example.com', roles: ['USER'], enabled: true }))
  })
}

test('connects a personal Telegram chat and disconnects it', async ({ page }) => {
  await login(page)
  let connected = false
  await page.route('**/api/v1/telegram**', async (route) => {
    const request = route.request()
    expect(request.headers().authorization).toBe('Bearer test-access')
    if (request.method() === 'POST') {
      await route.fulfill({ json: { data: { url: 'https://t.me/test_bot?start=' + 'A'.repeat(43), expiresInSeconds: 600 } } })
    } else if (request.method() === 'DELETE') {
      connected = false
      await route.fulfill({ json: { data: null } })
    } else await route.fulfill({ json: { data: { available: true, connected } } })
  })
  await page.goto('/telegram')
  await page.getByRole('button', { name: 'Connect Telegram', exact: true }).click()
  const link = page.getByRole('link', { name: 'Open Telegram and press Start' })
  await expect(link).toHaveAttribute('href', 'https://t.me/test_bot?start=' + 'A'.repeat(43))
  await expect(page.getByText('This personal connection link expires in 10 minutes. Keep it private.')).toBeVisible()
  connected = true
  await expect(page.getByText('Telegram connected. Budget alerts are enabled.')).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Disconnect Telegram' }).click()
  await expect(page.getByRole('button', { name: 'Connect Telegram', exact: true })).toBeVisible()
})

test('shows the disabled-bot state without exposing credentials', async ({ page }) => {
  await login(page)
  await page.route('**/api/v1/telegram', async (route) => {
    await route.fulfill({ json: { data: { available: false, connected: false } } })
  })
  await page.goto('/telegram')
  await expect(page.getByText('Telegram alerts are not configured yet. Ask your administrator to enable the Telegram bot.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect Telegram', exact: true })).toHaveCount(0)
})

test('shows both overall currencies and submits a KHR budget', async ({ page }) => {
  await login(page)
  let submitted: { currency?: string; monthlyLimit?: number } | undefined
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/categories')) {
      await route.fulfill({ json: { data: [] } })
    } else if (path.endsWith('/expenses')) {
      await route.fulfill({ json: { data: [], page: 0, size: 100, totalElements: 0, totalPages: 0 } })
    } else if (path.endsWith('/budgets/usage')) {
      await route.fulfill({ json: { data: ['USD', 'KHR'].map((currency) => ({
        budget: { id: currency, currency, monthlyLimit: 100, month: 10, year: 2026 },
        spentAmount: 20, remainingAmount: 80, expenseCount: 1, usagePercentage: 20, exceeded: false,
      })) } })
    } else if (path.endsWith('/budgets') && route.request().method() === 'POST') {
      submitted = route.request().postDataJSON()
      await route.fulfill({ json: { data: { id: 'new', ...submitted, month: 10, year: 2026 } } })
    } else await route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/budgets')
  await expect(page.getByRole('button', { name: 'Edit overall budget', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Set budget', exact: true }).click()
  await page.getByLabel('Currency', { exact: true }).selectOption('KHR')
  await page.getByRole('spinbutton', { name: /Monthly limit/ }).fill('400000')
  await page.getByRole('button', { name: 'Save budget', exact: true }).click()
  await expect.poll(() => submitted?.currency).toBe('KHR')
  expect(submitted?.monthlyLimit).toBe(400000)
})

test('explains a missing Telegram endpoint without claiming the bot is unconfigured', async ({ page }) => {
  await login(page)
  await page.route('**/api/v1/telegram', async (route) => {
    await route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'No handler for GET /api/v1/telegram' } })
  })
  await page.goto('/telegram')
  await expect(page.getByText('Telegram is not available on this server yet.', { exact: true })).toBeVisible()
  await expect(page.getByText('The service needs to be updated before you can connect Telegram.')).toBeVisible()
  await expect(page.getByText('Telegram alerts are not configured yet. Ask your administrator to enable the Telegram bot.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Connect Telegram', exact: true })).toHaveCount(0)
})
