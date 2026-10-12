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

async function openDashboard(page: Page, onlyKhr = false, failSecondPage = false, scenarioExpenses = expenses) {
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
      const rows = scenarioExpenses.filter((expense) =>
        (!onlyKhr || expense.currency === 'KHR')
        && expense.expenseDate >= (url.searchParams.get('fromDate') ?? '')
        && expense.expenseDate <= (url.searchParams.get('toDate') ?? '9999-12-31'))
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

test('uses calendar months for totals and budgets and keeps the month when regrouping', async ({ page }) => {
  const scenario = [
    { ...expenses[0], id: 'september', amount: 40000, expenseDate: '2026-09-30' },
    { ...expenses[0], id: 'october-start', amount: 5, currency: 'USD', expenseDate: '2026-10-01' },
    { ...expenses[0], id: 'october-end', amount: 20000, expenseDate: '2026-10-31' },
    { ...expenses[0], id: 'november', amount: 100000, expenseDate: '2026-11-01' },
    { ...expenses[0], id: 'leap-day', amount: 8000, expenseDate: '2024-02-29' },
  ]
  const budgetRequests: URL[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname.endsWith('/budgets/usage')) budgetRequests.push(new URL(request.url()))
  })
  const requests = await openDashboard(page, false, false, scenario)
  await expect(card(page, 'Total spend')).toContainText('$10.00')
  await expect(card(page, 'Total spend')).toContainText('2 expenses')
  await page.getByRole('button', { name: 'Weekly', exact: true }).click()
  await expect(card(page, 'Total spend')).toContainText('$10.00')
  await page.getByRole('button', { name: 'Monthly', exact: true }).click()
  await expect(card(page, 'Total spend')).toContainText('$10.00')
  await page.locator('#dashboard-currency').selectOption('USD')
  await page.getByLabel('Month', { exact: true }).fill('2026-09')
  await expect(card(page, 'Total spend')).toContainText('$10.00')
  await expect(card(page, 'Total spend')).toContainText('1 expense')
  await page.getByLabel('Month', { exact: true }).fill('2024-02')
  await expect(card(page, 'Total spend')).toContainText('$2.00')
  expect(requests.some(url => url.searchParams.get('fromDate') === '2024-02-01' && url.searchParams.get('toDate') === '2024-02-29')).toBe(true)
  await expect.poll(() => budgetRequests.some(url => url.searchParams.get('year') === '2024' && url.searchParams.get('month') === '2')).toBe(true)
  await page.getByLabel('Month', { exact: true }).fill('2026-12')
  await expect(card(page, 'Total spend')).toContainText('$0.00')
  await expect(card(page, 'Total spend')).toContainText('0 expenses')
  await page.getByLabel('Month', { exact: true }).fill('2026-10')
  await expect(card(page, 'Total spend')).toContainText('$10.00')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByLabel('Month', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '../backend/target/dashboard-month-mobile.png', fullPage: true })
})

test('converts USD and KHR totals, averages, categories and budgets across pages', async ({ page }) => {
  const requests = await openDashboard(page)
  await expect(card(page, 'Total spend')).toContainText('$89.61')
  await expect(card(page, 'Total spend')).toContainText('104 expenses')
  await expect(card(page, 'Average expense')).toContainText('$0.86')
  await expect(card(page, 'Budget left')).toContainText('$160.39')
  await expect(card(page, 'Budget left')).toContainText('35.8% of $250.00 used')
  await expect(card(page, 'Budget left')).not.toContainText('-$4,338.48')
  await expect(page.getByText('$4,588.48', { exact: true })).toHaveCount(0)
  // React StrictMode can abort and restart the first request in development.
  expect(new Set(requests.map((url) => url.searchParams.get('page')))).toEqual(new Set(['0', '1']))
  await expect(page.getByLabel('Month', { exact: true })).toHaveValue('2026-10')
  expect(requests.some((url) => url.searchParams.get('fromDate') === '2026-10-01' && url.searchParams.get('toDate') === '2026-10-31')).toBe(true)

  await page.getByLabel('Currency', { exact: true }).selectOption('KHR')
  const money = (amount: number) => page.evaluate((amount) => new Intl.NumberFormat('km-KH', {
    style: 'currency', currency: 'KHR', maximumFractionDigits: 2,
  }).format(amount), amount)
  await expect(card(page, 'Total spend')).toContainText(await money(358420))
  await expect(card(page, 'Total spend')).toContainText('104 expenses')
  await expect(card(page, 'Average expense')).toContainText(await money(358420 / 104))
  await expect(card(page, 'Budget left')).toContainText(await money(-348420))
  await expect(card(page, 'By category')).toContainText(await money(2500))
  await expect(card(page, 'By category')).toContainText(await money(355920))
  await expect(card(page, 'By category')).toContainText('99.3%')
  await page.getByRole('button', { name: 'Weekly', exact: true }).click()
  await expect(card(page, 'Total spend')).toContainText(await money(358420))
  await page.getByRole('button', { name: 'Monthly', exact: true }).click()
  await expect(card(page, 'Total spend')).toContainText(await money(358420))
  await page.getByLabel('Currency', { exact: true }).selectOption('USD')
  await expect(card(page, 'Total spend')).toContainText('$89.61')
  await page.goto('/budgets')
  await expect(page.getByText('$89.61 spent of $250.00 across 104 expenses', { exact: true })).toBeVisible()
  await expect(page.getByText('$160.39 remaining', { exact: true })).toBeVisible()
  await expect(page.getByText('35.8%', { exact: true })).toBeVisible()
})

test('defaults to riel when all expenses are KHR', async ({ page }) => {
  await openDashboard(page, true)
  await expect(page.getByLabel('Currency', { exact: true })).toHaveValue('KHR')
  await expect(card(page, 'Total spend')).toContainText('101 expenses')
  await expect(card(page, 'Total spend')).not.toContainText('$')
  await page.getByLabel('Currency', { exact: true }).selectOption('USD')
  await expect(card(page, 'Total spend')).toContainText('$1.13')
  await expect(card(page, 'Total spend')).toContainText('101 expenses')
})

for (const language of ['en', 'km']) {
  test(`switches a mixed 509020 KHR total correctly in ${language}`, async ({ page }) => {
    await page.addInitScript(language => localStorage.setItem('expense-tracker.language', language), language)
    // Synthetic entries matching the screenshot's total and count, not private account data.
    const scenario = [
      { id: 'usd-housing', amount: 64, currency: 'USD' },
      ...Array.from({ length: 10 }, (_, index) => ({ id: `usd-${index}`, amount: 3.6, currency: 'USD' })),
      ...Array.from({ length: 10 }, (_, index) => ({ id: `khr-${index}`, amount: 9000, currency: 'KHR' })),
      { id: 'khr-extra', amount: 19020, currency: 'KHR' },
    ].map(row => ({ ...row, expenseDate: '2026-10-08', category: food,
      description: row.id, paymentMethod: 'CASH', tags: [] }))
    await openDashboard(page, false, false, scenario)
    const total = page.locator('.card').first()
    const expected = async (amount: number, currency: string) => page.evaluate(({ amount, currency, language }) =>
      new Intl.NumberFormat(language === 'km' || currency === 'KHR' ? 'km-KH' : 'en-US', {
        style: 'currency', currency, maximumFractionDigits: 2,
      }).format(amount), { amount, currency, language })
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.locator('#dashboard-currency').selectOption('KHR')
      await expect(total).toContainText(await expected(509020, 'KHR'))
      await page.locator('#dashboard-currency').selectOption('USD')
      await expect(total).toContainText(await expected(127.255, 'USD'))
    }
  })
}

test('shows unavailable instead of a partial total when a later page fails', async ({ page }) => {
  await openDashboard(page, false, true)
  await expect(card(page, 'Total spend')).toContainText('Unavailable', { timeout: 15000 })
  await expect(card(page, 'Average expense')).toContainText('Unavailable')
  await expect(card(page, 'Budgets')).toContainText('Unavailable')
})
