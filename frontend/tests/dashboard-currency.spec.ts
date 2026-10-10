import { expect, test, type Page } from '@playwright/test'

const food = { id: 'food', name: 'Food', colorHex: '#22c55e' }
const rent = { id: 'rent', name: 'Rent', colorHex: '#3b82f6' }
const expenses = [
  ...Array.from({ length: 100 }, (_, index) => ({ id: 'riel-' + index, amount: 20, currency: 'KHR', expenseDate: '2026-10-05', category: food })),
  { id: 'rent', amount: 2500, currency: 'KHR', expenseDate: '2026-10-06', category: rent },
  { id: 'dollar-1', amount: 88.18, currency: 'USD', expenseDate: '2026-10-04', category: food },
  { id: 'dollar-2', amount: 0.1, currency: 'USD', expenseDate: '2026-10-06', category: food },
  { id: 'dollar-3', amount: 0.2, currency: 'USD', expenseDate: '2026-10-08', category: food },
].map((expense) => ({ ...expense, description: expense.id, paymentMethod: 'CASH', tags: [] }))

async function openDashboard(page: Page, onlyKhr = false, failSecondPage = false) {
  await page.clock.setFixedTime(new Date('2026-10-10T05:00:00Z'))
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'test-user', username: 'user', roles: ['USER'], enabled: true }))
  })
  const requests: URL[] = []
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    if (path.endsWith('/expenses')) {
      requests.push(url)
      expect(route.request().headers().authorization).toBe('Bearer test-access')
      const current = Number(url.searchParams.get('page') ?? 0)
      const rows = onlyKhr ? expenses.filter((expense) => expense.currency === 'KHR') : expenses
      if (failSecondPage && current === 1) {
        await route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE', message: 'Unavailable' } })
      } else await route.fulfill({ json: { data: rows.slice(current * 100, (current + 1) * 100), page: current,
        size: 100, totalElements: rows.length, totalPages: Math.ceil(rows.length / 100) } })
    } else if (path.endsWith('/budgets/usage')) {
      await route.fulfill({ json: { data: [
        // Reproduce the legacy server's mixed-currency budget figures.
        { budget: { id: 'usd-budget', monthlyLimit: 250, month: 10, year: 2026 }, spentAmount: 4588.48,
          remainingAmount: -4338.48, expenseCount: 104, usagePercentage: 1835.39, exceeded: true },
        { budget: { id: 'khr-budget', currency: 'KHR', monthlyLimit: 10000, month: 10, year: 2026 }, spentAmount: 4500,
          remainingAmount: 5500, expenseCount: 101, usagePercentage: 45, exceeded: false },
      ] } })
    } else if (path.endsWith('/categories')) {
      await route.fulfill({ json: { data: [food, rent] } })
    } else if (path.endsWith('/recent')) {
      await route.fulfill({ json: { data: [] } })
    } else {
      await route.fulfill({ status: 404, json: { message: 'Unexpected API request: ' + path } })
    }
  })
  await page.goto('/')
  return requests
}

function card(page: Page, label: string) {
  return page.locator('.card').filter({ has: page.getByText(label, { exact: true }) })
}

test('keeps USD and KHR totals, averages, categories and budgets separate across pages', async ({ page }) => {
  const requests = await openDashboard(page)
  await expect(card(page, 'Total spend')).toContainText('$88.48')
  await expect(card(page, 'Total spend')).toContainText('3 expenses')
  await expect(card(page, 'Average expense')).toContainText('$29.49')
  await expect(card(page, 'Budget left')).toContainText('$161.52')
  await expect(card(page, 'Budget left')).toContainText('35.4% of $250.00 used')
  await expect(card(page, 'Budget left')).not.toContainText('-$4,338.48')
  await expect(page.getByText('$4,588.48', { exact: true })).toHaveCount(0)
  // React StrictMode can abort and restart the first request in development.
  expect(new Set(requests.map((url) => url.searchParams.get('page')))).toEqual(new Set(['0', '1']))
  expect(requests.some((url) => url.searchParams.get('fromDate') === '2026-09-10' && url.searchParams.get('toDate') === '2026-10-10')).toBe(true)
  expect(requests.some((url) => url.searchParams.get('fromDate') === '2026-10-01' && url.searchParams.get('toDate') === '2026-10-31')).toBe(true)

  await page.getByLabel('Currency', { exact: true }).selectOption('KHR')
  const money = (amount: number) => page.evaluate((amount) => new Intl.NumberFormat('km-KH', {
    style: 'currency', currency: 'KHR', maximumFractionDigits: 2,
  }).format(amount), amount)
  await expect(card(page, 'Total spend')).toContainText(await money(4500))
  await expect(card(page, 'Total spend')).toContainText('101 expenses')
  await expect(card(page, 'Average expense')).toContainText(await money(4500 / 101))
  await expect(card(page, 'Budget left')).toContainText(await money(5500))
  await expect(card(page, 'By category')).toContainText(await money(2500))
  await expect(card(page, 'By category')).toContainText(await money(2000))
  await expect(card(page, 'By category')).toContainText('55.6%')
  await page.getByRole('button', { name: 'Weekly', exact: true }).click()
  await expect(card(page, 'Total spend')).toContainText(await money(4500))
  await page.getByRole('button', { name: 'Monthly', exact: true }).click()
  await expect(card(page, 'Total spend')).toContainText(await money(4500))
  await page.getByLabel('Currency', { exact: true }).selectOption('USD')
  await expect(card(page, 'Total spend')).toContainText('$88.48')
  await page.goto('/budgets')
  await expect(page.getByText('$88.48 spent of $250.00 across 3 expenses', { exact: true })).toBeVisible()
  await expect(page.getByText('$161.52 remaining', { exact: true })).toBeVisible()
  await expect(page.getByText('35.4%', { exact: true })).toBeVisible()
})

test('defaults to riel when all expenses are KHR', async ({ page }) => {
  await openDashboard(page, true)
  await expect(page.getByLabel('Currency', { exact: true })).toHaveValue('KHR')
  await expect(card(page, 'Total spend')).toContainText('101 expenses')
  await expect(card(page, 'Total spend')).not.toContainText('$')
  await page.getByLabel('Currency', { exact: true }).selectOption('USD')
  await expect(card(page, 'Total spend')).toContainText('$0.00')
  await expect(card(page, 'Total spend')).toContainText('0 expenses')
})

test('shows unavailable instead of a partial total when a later page fails', async ({ page }) => {
  await openDashboard(page, false, true)
  await expect(card(page, 'Total spend')).toContainText('Unavailable', { timeout: 15000 })
  await expect(card(page, 'Average expense')).toContainText('Unavailable')
  await expect(card(page, 'Budgets')).toContainText('Unavailable')
})
