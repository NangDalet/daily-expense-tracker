import { expect, test, type Page } from '@playwright/test'

const income = { id: 'income-1', amount: 1234.56, currency: 'USD', incomeDate: '2026-10-12',
  description: 'Salary', paymentMethod: 'CASH', tags: [] }

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'test-user', username: 'user', roles: ['USER'], enabled: true }))
  })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/verify-password')) {
      expect(route.request().headers().authorization).toBe('Bearer test-access')
      const correct = route.request().postDataJSON().password === 'correct-password'
      await route.fulfill({ status: correct ? 200 : 403,
        json: correct ? { message: 'Password verified' } : { code: 'FORBIDDEN', message: 'Password verification failed' } })
    } else if (path.endsWith('/incomes')) {
      await route.fulfill({ json: { data: [income], page: 0, size: 20, totalElements: 1, totalPages: 1 } })
    } else if (path.endsWith('/incomes/summary')) {
      await route.fulfill({ json: { data: [{ totalAmount: 1234.56, currency: 'USD', incomeCount: 1 }] } })
    } else if (path.endsWith('/incomes/recent')) {
      await route.fulfill({ json: { data: [income] } })
    } else if (path.endsWith('/reports/monthly')) {
      await route.fulfill({ json: { data: [{ currency: 'USD', totalIncome: 1234.56, totalExpenses: 200, balance: 1034.56, incomeCount: 1, expenseCount: 1 }] } })
    } else {
      await route.fulfill({ json: { data: [], page: 0, size: 100, totalElements: 0, totalPages: 0 } })
    }
  })
}

async function unlock(page: Page) {
  await page.getByLabel(/^Password/).fill('correct-password')
  await page.getByRole('button', { name: 'Verify password', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Show income amount', exact: true })).toHaveCount(0)
}

test('requires the correct password, hides automatically, and requires confirmation again', async ({ page }) => {
  await setup(page)
  await page.clock.install()
  await page.goto('/incomes')
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show income amount', exact: true }).first().click()
  await page.getByLabel(/^Password/).fill('wrong')
  await page.getByRole('button', { name: 'Verify password', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Password verification failed')
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
  await unlock(page)
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(1)
  await page.clock.fastForward(30_001)
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show income amount', exact: true }).first().click()
  await unlock(page)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
})

test('protects editing and removes the amount from delete confirmation', async ({ page }) => {
  await setup(page)
  await page.goto('/incomes')
  await page.getByRole('button', { name: 'Edit Salary', exact: true }).first().click()
  await expect(page.getByRole('dialog', { name: 'Show income amount' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Edit income' })).toHaveCount(0)
  await unlock(page)
  await expect(page.getByRole('dialog', { name: 'Edit income' })).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete Salary', exact: true }).first().click()
  await expect(page.getByRole('dialog')).not.toContainText('1,234.56')
})

test('keeps mobile income, dashboard income, and monthly income and balance hidden', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/incomes')
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Show income amount', exact: true }).last().click()
  await unlock(page)
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(1)
  await page.goto('/')
  await expect(page.getByText('Salary', { exact: true })).toBeVisible()
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
  await page.goto('/monthly')
  await expect(page.getByText('Monthly income', { exact: true })).toBeVisible()
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
  await expect(page.getByText('$1,034.56', { exact: true })).toHaveCount(0)
})

test('ignores password verification that finishes after cancellation', async ({ page }) => {
  await setup(page)
  let finish: (() => void) | undefined
  await page.route('**/api/v1/auth/verify-password', async (route) => {
    await new Promise<void>((resolve) => { finish = resolve })
    await route.fulfill({ json: { message: 'Password verified' } })
  })
  await page.goto('/incomes')
  await page.getByRole('button', { name: 'Show income amount', exact: true }).first().click()
  await page.getByLabel(/^Password/).fill('correct-password')
  await page.getByRole('button', { name: 'Verify password', exact: true }).click()
  await expect.poll(() => Boolean(finish)).toBe(true)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const response = page.waitForResponse('**/api/v1/auth/verify-password')
  finish!()
  await response
  await expect(page.getByText('$1,234.56', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hide income amount', exact: true })).toHaveCount(0)
})
