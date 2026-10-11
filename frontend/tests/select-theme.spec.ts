import { expect, test } from '@playwright/test'

test('expense form and filter dropdown options stay readable when switching themes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.theme', 'dark')
    localStorage.setItem('expense-tracker.language', 'en')
    localStorage.setItem('expense-tracker.user', JSON.stringify({
      id: 'test-user', username: 'theme-test', email: 'test@example.com', roles: ['USER'], enabled: true,
    }))
  })
  await page.route('**/api/v1/**', async (route) => {
    const categories = new URL(route.request().url()).pathname.endsWith('/categories')
    await route.fulfill({ json: categories
      ? { data: [{ id: 'food', name: 'Food' }] }
      : { data: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } })
  })
  await page.goto('/expenses?new=1')
  const dialog = page.getByRole('dialog')
  const payment = dialog.getByLabel('Payment method')
  await expect(payment).toBeVisible()

  async function optionColors() {
    return page.locator('select option').evaluateAll(options => options.map(option => {
      const style = getComputedStyle(option)
      // Resolve CSS color spaces to pixels so browser serialization does not affect the check.
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')!
      context.fillStyle = style.color
      context.fillRect(0, 0, 1, 1)
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
      return { background: style.backgroundColor, text: `rgb(${red}, ${green}, ${blue})` }
    }))
  }
  const dark = await optionColors()
  expect(dark.length).toBeGreaterThan(10)
  for (const color of dark) expect(color).toEqual({ background: 'rgb(22, 34, 53)', text: 'rgb(241, 245, 249)' })
  expect(await payment.evaluate(element => getComputedStyle(element).colorScheme)).toBe('dark')
  await payment.selectOption('BANK_TRANSFER')
  await expect(payment).toHaveValue('BANK_TRANSFER')
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.getByRole('button', { name: 'Add expense', exact: true }).last().click()
  await expect(payment).toBeVisible()
  for (const color of await optionColors()) {
    expect(color.background).toBe('rgb(255, 255, 255)')
    for (const channel of color.text.match(/\d+/g)!) expect(Number(channel)).toBeLessThan(50)
  }
})
