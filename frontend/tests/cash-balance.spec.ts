import { expect, test, type Page } from '@playwright/test'

async function openCash(page: Page) {
  const topups: { id: string; amount: number; currency: string; topupDate: string; note?: string }[] = []
  const expenses: { id: string; amount: number; currency: string; expenseDate: string; paymentMethod: string; useTopupBalance: boolean }[] = []
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.language', 'en')
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({
      id: 'test-user', username: 'cash-test', email: 'test@example.com', roles: ['USER'], enabled: true,
    }))
  })
  const balances = () => ['USD', 'KHR'].map(currency => {
    const totalTopups = topups.filter(t => t.currency === currency).reduce((sum, t) => sum + t.amount, 0)
    const totalSpent = expenses.filter(e => e.currency === currency && e.useTopupBalance).reduce((sum, e) => sum + e.amount, 0)
    return { currency, totalTopups, totalSpent, remainingAmount: totalTopups - totalSpent }
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    if (path === '/expenses/totals') return route.fulfill({ json: { data: ['USD', 'KHR'].map(currency => {
      const matching = expenses.filter(e => e.currency === currency)
      return { currency, totalAmount: matching.reduce((sum, e) => sum + e.amount, 0), expenseCount: matching.length }
    }) } })
    if (path === '/cash/balances') return route.fulfill({ json: { data: balances() } })
    if (path === '/cash/topups' && request.method() === 'POST') {
      const body = request.postDataJSON()
      const entry = { ...body, id: 'topup-' + topups.length }
      topups.push(entry)
      return route.fulfill({ status: 201, json: { data: entry } })
    }
    if (path === '/cash/topups') return route.fulfill({ json: { data: topups, page: 0, size: 10, totalPages: 1, totalElements: topups.length } })
    if (path === '/categories') return route.fulfill({ json: { data: [] } })
    if (path === '/expenses' && request.method() === 'POST') {
      const body = request.postDataJSON()
      const available = balances().find(b => b.currency === body.currency)!.remainingAmount
      if (body.useTopupBalance && body.amount > available) return route.fulfill({ status: 400,
        json: { code: 'VALIDATION_ERROR', message: 'Insufficient USD top-up balance. Add a top-up or reduce the expense.' } })
      const expense = { ...body, id: 'expense-' + expenses.length }
      expenses.push(expense)
      return route.fulfill({ status: 201, json: { data: expense } })
    }
    if (path === '/expenses') return route.fulfill({ json: { data: expenses, page: 0, size: 20, totalPages: 1, totalElements: expenses.length } })
    return route.fulfill({ status: 404, json: { message: 'Unexpected API request' } })
  })
  await page.goto('/expenses')
  await expect(page.getByRole('heading', { name: 'Cash top-up balance' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add expense', exact: true })).toHaveCount(1)
  return { topups, expenses }
}

test('adds cash, spends from it, shows remaining money and rejects overspending', async ({ page }) => {
  const state = await openCash(page)
  await page.getByRole('button', { name: 'Add top-up', exact: true }).click()
  const topupDialog = page.getByRole('dialog', { name: 'Add top-up', exact: true })
  await topupDialog.getByLabel('Amount').fill('100')
  await topupDialog.getByLabel('Note', { exact: true }).fill('Bank withdrawal')
  await topupDialog.getByRole('button', { name: 'Add top-up', exact: true }).click()
  await expect(topupDialog).toBeHidden()
  expect(state.topups).toHaveLength(1)
  await page.getByText('Balance details', { exact: true }).click()
  await expect(page.getByText('Total top-ups', { exact: true }).first()).toBeVisible()
  await page.getByText('Balance details', { exact: true }).click()
  await page.getByRole('button', { name: 'Show top-up history' }).click()
  await expect(page.getByText('Bank withdrawal', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click()
  const expenseDialog = page.getByRole('dialog', { name: 'Add expense', exact: true })
  await expect(expenseDialog.getByLabel('Payment method')).toHaveValue('TOPUP')
  await expenseDialog.getByLabel('Payment method').selectOption('E_WALLET')
  await expect(expenseDialog.getByText('Available cash', { exact: false })).toBeHidden()
  await expenseDialog.getByLabel('Payment method').selectOption({ label: 'Top-up balance' })
  await expect(expenseDialog.getByLabel('Payment method')).toHaveValue('TOPUP')
  await expenseDialog.getByLabel('Amount').fill('30')
  await expenseDialog.getByRole('button', { name: 'Add expense', exact: true }).click()
  await expect(expenseDialog).toBeHidden()
  expect(state.expenses[0].useTopupBalance).toBe(true)
  expect(state.expenses[0].paymentMethod).toBe('CASH')
  await expect(page.getByText('$70.00', { exact: true })).toBeVisible()
  await expect(page.getByText('From top-up', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click()
  await expenseDialog.getByLabel('Amount').fill('80')
  await expect(expenseDialog.getByText('Not enough cash. Add a top-up or reduce the amount.')).toBeVisible()
  await expenseDialog.getByRole('button', { name: 'Add expense', exact: true }).click()
  await expect(expenseDialog.getByText('Insufficient USD top-up balance. Add a top-up or reduce the expense.', { exact: true })).toBeVisible()
  expect(state.expenses).toHaveLength(1)
  await expenseDialog.getByLabel('Payment method').selectOption('BANK_TRANSFER')
  await expect(expenseDialog.getByText('Available cash', { exact: false })).toBeHidden()
  await expenseDialog.getByRole('button', { name: 'Add expense', exact: true }).click()
  await expect(expenseDialog).toBeHidden()
  expect(state.expenses[1].useTopupBalance).toBe(false)
  await expect(page.getByText('$70.00', { exact: true })).toBeVisible()
  await expect(page.getByText('$110.00', { exact: true })).toBeVisible()
})

test('shows separate KHR cash and works on a narrow screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openCash(page)
  await page.getByRole('button', { name: 'Add top-up', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Add top-up', exact: true })
  await dialog.getByLabel('Amount').fill('40000')
  await dialog.getByLabel('Currency').selectOption('KHR')
  await dialog.getByRole('button', { name: 'Add top-up', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('$0.00', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click()
  const expenseDialog = page.getByRole('dialog', { name: 'Add expense', exact: true })
  await expect(expenseDialog).toBeFocused()
  expect(await expenseDialog.getByLabel('Amount').evaluate(element => getComputedStyle(element).fontSize)).toBe('16px')
  const bounds = await expenseDialog.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.width).toBeLessThanOrEqual(390)
  const save = expenseDialog.getByRole('button', { name: 'Add expense', exact: true })
  const saveBounds = await save.boundingBox()
  expect(saveBounds!.y + saveBounds!.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: testInfo.outputPath('phone-expense-form.png') })
  // A smaller visible viewport models the space available above a phone keyboard.
  await page.setViewportSize({ width: 390, height: 450 })
  await expect(expenseDialog).toBeVisible()
  await expect.poll(async () => {
    const button = await save.boundingBox()
    return button!.y + button!.height
  }).toBeLessThanOrEqual(450)
  await page.setViewportSize({ width: 390, height: 844 })
  await expenseDialog.getByLabel('Currency').selectOption('KHR')
  await expenseDialog.getByLabel('Amount').fill('4000')
  await expect(expenseDialog.getByLabel('Payment method')).toHaveValue('TOPUP')
  await expenseDialog.getByRole('button', { name: 'Add expense', exact: true }).click()
  await expect(expenseDialog).toBeHidden()
  await expect(page.getByText('From top-up', { exact: true }).last()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
