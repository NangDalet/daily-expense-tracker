import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'test-user', username: 'user', roles: ['USER'], enabled: true }))
    localStorage.setItem('expense-tracker.language', 'en')
  })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/construction/access')
      ? { allowed: true, manager: true, constructionRole: 'MANAGER', siteIds: [] }
      : []
    await route.fulfill({ json: { data, page: 0, totalElements: 0, totalPages: 0, size: 20 } })
  })
  await page.goto('/incomes')
  await expect(page.getByRole('heading', { name: 'Income this month' })).toBeVisible()
}

const constructionModule = /\/(?:src\/pages\/ConstructionPage\.tsx|assets\/ConstructionPage-[^/]+\.js)(?:\?.*)?$/

test('keeps the app shell visible while switching modules without a document request', async ({ page }) => {
  await setup(page)
  const documents: string[] = []
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()) })
  const sidebar = await page.locator('aside').elementHandle()
  const header = await page.locator('header').elementHandle()
  let finish: (() => void) | undefined
  await page.route(constructionModule, async route => {
    await new Promise<void>(resolve => { finish = resolve })
    await route.continue()
  })
  await page.getByRole('link', { name: 'Construction payments', exact: true }).click()
  await expect.poll(() => Boolean(finish)).toBe(true)
  await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeVisible()
  await expect(page.locator('header')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Loading')
  finish!()
  await expect(page.getByRole('heading', { name: 'Construction worker payments' })).toBeVisible()
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click()
  await page.getByRole('tab', { name: 'Workers', exact: true }).click()
  await page.getByRole('link', { name: 'Income', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Income this month' })).toBeVisible()
  expect(await sidebar!.evaluate(element => element.isConnected)).toBe(true)
  expect(await header!.evaluate(element => element.isConnected)).toBe(true)
  expect(documents).toEqual([])
})

test('a module loading failure shows a retry option and leaves navigation available', async ({ page }) => {
  await setup(page)
  const documents: string[] = []
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()) })
  await page.route(constructionModule, route => route.abort())
  await page.getByRole('link', { name: 'Construction payments', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load this page')
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Income', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Income this month' })).toBeVisible()
  expect(documents).toEqual([])
})

test('preload failures never trigger an automatic document reload', async ({ page }) => {
  await setup(page)
  const documents: string[] = []
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()) })
  await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError', { cancelable: true })))
  await page.getByRole('link', { name: 'Monthly calculator', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Monthly calculator', exact: true })).toBeVisible()
  expect(documents).toEqual([])
})
