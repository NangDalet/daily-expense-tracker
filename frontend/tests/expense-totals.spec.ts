import { expect, test } from '@playwright/test'

test('shows totals across every page and updates them with search filters', async ({ page }, testInfo) => {
  const expenses = Array.from({ length: 26 }, (_, index) => ({
    id: 'expense-' + index, amount: index === 25 ? 4000 : 1, currency: index === 25 ? 'KHR' : 'USD',
    expenseDate: '2026-10-13', paymentMethod: 'E_WALLET', description: index === 0 ? 'Lunch' : 'Other spending',
  }))
  const totalRequests: string[] = []
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.language', 'en')
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'test-user', username: 'totals-test', roles: ['USER'], enabled: true }))
  })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/v1', '')
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    const matching = expenses.filter(expense => expense.description.toLowerCase().includes(search))
    if (path === '/expenses/totals') {
      totalRequests.push(url.search)
      if (search === 'broken') return route.fulfill({ status: 503, json: { message: 'Totals unavailable' } })
      return route.fulfill({ json: { data: ['USD', 'KHR'].map(currency => ({ currency,
        totalAmount: matching.filter(expense => expense.currency === currency).reduce((sum, expense) => sum + expense.amount, 0),
        expenseCount: matching.filter(expense => expense.currency === currency).length,
      })) } })
    }
    if (path === '/expenses') {
      const currentPage = Number(url.searchParams.get('page') ?? 0)
      const size = Number(url.searchParams.get('size') ?? 20)
      return route.fulfill({ json: { data: matching.slice(currentPage * size, (currentPage + 1) * size), page: currentPage,
        size, totalElements: matching.length, totalPages: Math.ceil(matching.length / size) } })
    }
    if (path === '/cash/balances') return route.fulfill({ json: { data: ['USD', 'KHR'].map(currency => ({ currency, totalTopups: 0, totalSpent: 0, remainingAmount: 0 })) } })
    if (path === '/categories') return route.fulfill({ json: { data: [] } })
    return route.fulfill({ status: 404, json: { message: 'Unexpected request' } })
  })
  await page.goto('/expenses')
  const totals = page.getByRole('heading', { name: 'Total expenses', exact: true }).locator('..')
  await expect(totals.getByText('$25.00', { exact: true })).toBeVisible()
  await expect(totals.getByText('25 expenses recorded', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add expense', exact: true })).toHaveCount(1)
  const firstExpense = await page.locator('tbody tr').first().boundingBox()
  expect(firstExpense).not.toBeNull()
  expect(firstExpense!.y + firstExpense!.height).toBeLessThan(800)
  await page.screenshot({ path: testInfo.outputPath('expenses-light.png') })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.screenshot({ path: testInfo.outputPath('expenses-dark.png') })
  const requestsBeforePaging = totalRequests.length
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible()
  await expect(totals.getByText('$25.00', { exact: true })).toBeVisible()
  expect(totalRequests).toHaveLength(requestsBeforePaging)
  expect(totalRequests.every(query => query === '')).toBe(true)
  await page.getByRole('searchbox', { name: 'Search expenses' }).fill('Lunch')
  await expect(totals.getByText('$1.00', { exact: true })).toBeVisible()
  await expect(totals.getByText('1 expense recorded', { exact: true })).toBeVisible()
  expect(totalRequests.at(-1)).toBe('?search=Lunch')
  await page.getByRole('searchbox', { name: 'Search expenses' }).fill('broken')
  await expect(totals.getByText('Could not load expense totals', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(totals.getByText('$1.00', { exact: true })).toBeHidden()
})
