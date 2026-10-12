import { expect, test } from '@playwright/test'

for (const module of ['expenses', 'incomes']) {
  for (const currency of ['USD', 'KHR']) {
    test(`${module} previews conversion and saves original ${currency}`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        localStorage.setItem('expense-tracker.accessToken', 'test-access')
        localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
        localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'test-user', username: 'user', roles: ['USER'], enabled: true }))
      })
      let submitted: { amount: number; currency: string } | undefined
      await page.route('**/api/v1/**', async route => {
        const url = new URL(route.request().url())
        if (route.request().method() === 'POST' && url.pathname.endsWith('/' + module)) {
          submitted = route.request().postDataJSON()
          await route.fulfill({ json: { data: { ...submitted, id: 'saved' } } })
        } else if (url.pathname.endsWith('/construction/access')) {
          await route.fulfill({ json: { data: { allowed: false, siteIds: [] } } })
        } else {
          await route.fulfill({ json: { data: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } })
        }
      })
      await page.goto(`/${module}?new=1`)
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Currency', { exact: true }).selectOption(currency)
      await dialog.getByLabel(/^Amount/).fill(currency === 'USD' ? '5' : '20000')
      await expect(dialog).toContainText('Fixed rate: 1 USD = 4,000 KHR')
      await expect(dialog).toContainText('$5.00')
      const khr = await page.evaluate(() => new Intl.NumberFormat('km-KH', { style: 'currency', currency: 'KHR', maximumFractionDigits: 2 }).format(20000))
      await expect(dialog).toContainText(khr)
      await dialog.getByRole('button', { name: module === 'expenses' ? 'Add expense' : 'Add income', exact: true }).click()
      await expect.poll(() => submitted).toMatchObject({ amount: currency === 'USD' ? 5 : 20000, currency })
      await expect(dialog).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }
}
