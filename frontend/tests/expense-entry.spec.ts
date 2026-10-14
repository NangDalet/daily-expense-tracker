import { expect, test, type Page } from '@playwright/test'

const category = { id: '569ce194-fb27-4c74-8c9a-87cdb274cca7', name: 'Breakfast' }
type Entry = { amount: number; description?: string; categoryId?: string; currency: string; paymentMethod: string; expenseDate: string }

async function setup(page: Page, initial: Entry[] = []) {
  const saved: Entry[] = [...initial]
  const posts: { path: string; body: any }[] = []
  const state = { categories: [category], failBatch: false }
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.language', 'en')
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'entry-user', username: 'entry-test', roles: ['USER'], enabled: true }))
  })
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (request.method() === 'POST' && path.startsWith('/expenses')) {
      const body = request.postDataJSON()
      posts.push({ path, body })
      if (state.failBatch) return route.fulfill({ status: 400, json: { code: 'VALIDATION_ERROR', message: 'Insufficient USD top-up balance.' } })
      const entries = path === '/expenses/batch' ? body.expenses : [body]
      saved.push(...entries)
      return route.fulfill({ status: 201, json: { data: entries } })
    }
    if (path === '/categories') return route.fulfill({ json: { data: state.categories } })
    if (path === '/cash/balances') return route.fulfill({ json: { data: [] } })
    if (path === '/expenses/totals') return route.fulfill({ json: { data: [{ currency: 'USD', totalAmount: saved.reduce((sum, entry) => sum + entry.amount, 0), expenseCount: saved.length }] } })
    if (path === '/expenses') return route.fulfill({ json: { data: saved.map((entry, index) => ({ ...entry, id: 'expense-' + index })), page: 0, size: 20, totalElements: saved.length, totalPages: saved.length ? 1 : 0 } })
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Unexpected request' } })
  })
  await page.goto('/expenses')
  return { state, posts, saved }
}

test('saves sandwich and coffee together with shared category and a correct total', async ({ page }, testInfo) => {
  const { posts } = await setup(page)
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Add multiple expenses').check()
  await form.getByLabel('Item 1', { exact: true }).fill('Sandwich')
  await form.getByLabel('Item amount 1', { exact: true }).fill('2.50')
  await form.getByLabel('Item 2', { exact: true }).fill('Coffee')
  await form.getByLabel('Item amount 2', { exact: true }).fill('1.25')
  await form.getByLabel('Category', { exact: true }).selectOption(category.id)
  await form.getByLabel('Description', { exact: true }).fill('Breakfast')
  await expect(form.getByText('Total: $3.75', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('breakfast-items.png') })
  await form.getByRole('button', { name: 'Add 2 expenses', exact: true }).click()
  await expect(form).toBeHidden()
  expect(posts).toHaveLength(1)
  expect(posts[0].path).toBe('/expenses/batch')
  expect(posts[0].body.expenses).toMatchObject([
    { description: 'Breakfast — Sandwich', amount: 2.5, categoryId: category.id, currency: 'USD', paymentMethod: 'CASH' },
    { description: 'Breakfast — Coffee', amount: 1.25, categoryId: category.id, currency: 'USD', paymentMethod: 'CASH' },
  ])
  await expect(page.locator('tbody tr')).toHaveCount(2)
})

test('clears a category deleted after selection without posting a stale ID', async ({ page }) => {
  const { state, posts } = await setup(page)
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByRole('spinbutton', { name: /^Amount/ }).fill('2.50')
  await form.getByLabel('Category', { exact: true }).selectOption(category.id)
  state.categories = []
  await form.getByRole('button', { name: 'Add expense', exact: true }).click()
  await expect(form.getByText('That category no longer exists. Pick another one.', { exact: true })).toBeVisible()
  await expect(form.getByLabel('Category', { exact: true })).toHaveValue('')
  await expect(form.getByRole('spinbutton', { name: /^Amount/ })).toHaveValue('2.50')
  expect(posts).toHaveLength(0)
  await form.getByRole('button', { name: 'Add expense', exact: true }).click()
  await expect(form).toBeHidden()
  expect(posts[0].body.categoryId).toBeNull()
})

test('editing an expense with a missing category clears the hidden old selection', async ({ page }) => {
  const { state } = await setup(page, [{ description: 'Old breakfast', amount: 2, currency: 'USD', paymentMethod: 'CASH', expenseDate: '2026-10-14', categoryId: 'deleted-category' }])
  state.categories = []
  await page.getByRole('button', { name: 'Edit Old breakfast', exact: true }).first().click()
  const form = page.getByRole('dialog')
  await expect(form.getByLabel('Category', { exact: true })).toHaveValue('')
  await expect(form.getByText('That category no longer exists. Pick another one.', { exact: true })).toBeVisible()
  await expect(form.getByLabel('Add multiple expenses')).toHaveCount(0)
})

test('validates rows, removes an item, and retains entered values after a failed batch', async ({ page }) => {
  const { state, posts } = await setup(page)
  state.failBatch = true
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Add multiple expenses').check()
  await form.getByRole('button', { name: 'Add 2 expenses', exact: true }).click()
  await expect(form.getByText('Item name is required', { exact: true })).toHaveCount(2)
  expect(posts).toHaveLength(0)
  await form.getByLabel('Item 1', { exact: true }).fill('Sandwich')
  await form.getByLabel('Item amount 1', { exact: true }).fill('2.50')
  await form.getByRole('button', { name: 'Remove item 2', exact: true }).click()
  await form.getByRole('button', { name: 'Add 1 expense', exact: true }).click()
  await expect(form.getByText('Insufficient USD top-up balance.', { exact: true })).toBeVisible()
  await expect(form.getByLabel('Item 1', { exact: true })).toHaveValue('Sandwich')
  state.failBatch = false
  await form.getByRole('button', { name: 'Add 1 expense', exact: true }).click()
  await expect(form).toBeHidden()
  expect(posts).toHaveLength(2)
  expect(posts.every(post => post.path === '/expenses/batch')).toBe(true)
})

test('multiple expense entry fits a phone screen and supports adding rows', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.getByRole('button', { name: 'Add expense', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Add multiple expenses').check()
  await form.getByRole('button', { name: 'Add item', exact: true }).click()
  await expect(form.getByLabel('Item 3', { exact: true })).toBeVisible()
  expect(await form.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await form.getByLabel('Item 1', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('breakfast-items-mobile.png') })
})
