import { expect, test } from '@playwright/test'

test('preloads sidebar destinations, preserves the shell and restores the top of each module', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.language', 'en')
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'test-user', username: 'navigation-test', roles: ['USER'], enabled: true }))
  })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/expenses')) return route.fulfill({ json: { data: Array.from({ length: 20 }, (_, index) => ({
      id: 'expense-' + index, amount: 1, currency: 'USD', expenseDate: '2026-10-13', paymentMethod: 'CASH', description: 'Lunch',
    })), page: 0, size: 20, totalElements: 20, totalPages: 1 } })
    if (path.endsWith('/cash/balances')) return route.fulfill({ json: { data: ['USD', 'KHR'].map(currency => ({ currency, totalTopups: 0, totalSpent: 0, remainingAmount: 0 })) } })
    if (path.endsWith('/expenses/totals')) return route.fulfill({ json: { data: [{ currency: 'USD', totalAmount: 20, expenseCount: 20 }] } })
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto('/expenses')
  await expect(page.getByRole('heading', { name: 'Total expenses', exact: true })).toBeVisible()
  // Identity survives the switch, so the sidebar is not torn down and recreated.
  await page.locator('aside').evaluate(element => element.setAttribute('data-shell-marker', 'preserved'))
  const nav = page.getByRole('navigation', { name: 'Main' })
  const categories = nav.getByRole('link', { name: 'Categories', exact: true })
  const moduleLoaded = page.waitForResponse(response =>
    /(?:src\/pages\/CategoriesPage\.tsx|assets\/CategoriesPage-[^/]+\.js)/.test(response.url()) && response.ok())
  await categories.hover()
  await moduleLoaded
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await categories.click()
  await expect(page.locator('main').getByRole('heading', { name: 'Categories', exact: true })).toBeVisible()
  await expect(categories).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('aside')).toHaveAttribute('data-shell-marker', 'preserved')
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await nav.getByRole('link', { name: 'Expenses', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Total expenses', exact: true })).toBeVisible()
  await categories.click()
  await expect(page.locator('main').getByRole('heading', { name: 'Categories', exact: true })).toBeVisible()
  await expect(page.getByText('Loading', { exact: true })).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await nav.getByRole('link', { name: 'Expenses', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Total expenses', exact: true })).toBeVisible()
  const duration = await page.locator('.module-page').evaluate(element => getComputedStyle(element).animationDuration)
  expect(Number.parseFloat(duration)).toBeLessThan(0.01)
})

test('mobile sidebar closes after switching modules', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.language', 'en')
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'test-user', username: 'navigation-test', roles: ['USER'], enabled: true }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.goto('/categories')
  await expect(page.locator('main').getByRole('heading', { name: 'Categories', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Budgets', exact: true }).click()
  await expect(page.locator('main').getByRole('heading', { name: 'Budgets', exact: true })).toBeVisible()
  await expect(page.locator('aside')).toHaveClass(/-translate-x-full/)
})
