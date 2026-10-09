import { expect, test, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { readFile } from 'node:fs/promises'

const expenses = Array.from({ length: 143 }, (_, index) => ({
  id: 'expense-' + index,
  expenseDate: '2026-10-01',
  description: index === 0 ? '=SUM(1,2)' : index === 1 ? 'Café lunch' : 'Export row ' + (index + 1),
  amount: 10.25,
  currency: index % 2 === 0 ? 'USD' : 'EUR',
  paymentMethod: 'CASH',
  category: { id: 'food', name: 'Food' },
  tags: ['test'],
  receiptUrl: 'https://example.com/receipt',
}))

async function openExpenses(page: Page, failure?: 'request' | 'changed') {
  const requests: URLSearchParams[] = []
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({
      id: 'test-user', username: 'export-test', email: 'test@example.com', roles: ['USER'], enabled: true,
    }))
  })
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/categories')) {
      await route.fulfill({ json: { data: [{ id: 'food', name: 'Food' }] } })
      return
    }
    if (!url.pathname.endsWith('/expenses')) {
      await route.fulfill({ status: 404, json: { message: 'Unexpected API request' } })
      return
    }
    const params = url.searchParams
    const size = Number(params.get('size') ?? 20)
    const currentPage = Number(params.get('page') ?? 0)
    if (size === 100) requests.push(params)
    if (size === 100 && currentPage === 1 && failure === 'request') {
      await route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE', message: 'Export service unavailable' } })
      return
    }
    const search = (params.get('search') ?? '').toLowerCase()
    const filtered = expenses.filter((expense) => expense.description.toLowerCase().includes(search))
    await route.fulfill({
      json: {
        data: filtered.slice(currentPage * size, (currentPage + 1) * size),
        page: currentPage, size,
        totalElements: filtered.length + (size === 100 && currentPage === 1 && failure === 'changed' ? 1 : 0),
        totalPages: Math.ceil(filtered.length / size),
      },
    })
  })
  await page.goto('/expenses')
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled()
  return requests
}

test('Excel exports every page with typed cells, safe descriptions and currency totals', async ({ page }, testInfo) => {
  const requests = await openExpenses(page)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('Page 2 of 8', { exact: true })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^expenses-\d{4}-\d{2}-\d{2}\.xlsx$/)
  const path = testInfo.outputPath('expenses.xlsx')
  await download.saveAs(path)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  const sheet = workbook.getWorksheet('Expenses')!
  expect(sheet.rowCount).toBe(144)
  expect(sheet.getCell('B2').value).toBe('=SUM(1,2)')
  expect(sheet.getCell('B2').type).toBe(ExcelJS.ValueType.String)
  expect(sheet.getCell('B3').value).toBe('Café lunch')
  expect(sheet.getCell('A2').value).toEqual(new Date('2026-10-01T00:00:00Z'))
  expect(sheet.getCell('E2').value).toBe(10.25)
  expect(sheet.getCell('B144').value).toBe('Export row 143')
  expect(sheet.getCell('H2').value).toBe('https://example.com/receipt')
  const summary = workbook.getWorksheet('Summary')!
  expect(summary.getRow(2).values).toEqual([undefined, 'EUR', 71, 727.75])
  expect(summary.getRow(3).values).toEqual([undefined, 'USD', 72, 738])
  expect(requests.map((params) => params.get('page'))).toEqual(['0', '1'])
  expect(requests.every((params) => params.get('sort') === 'expenseDate,desc')).toBe(true)
  await expect(page.getByRole('status')).toContainText('Downloaded 143 expenses as Excel')
})

test('PDF downloads a complete report across multiple pages', async ({ page }, testInfo) => {
  await openExpenses(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  const path = testInfo.outputPath('expenses.pdf')
  await download.saveAs(path)
  const contents = (await readFile(path)).toString('latin1')
  expect(contents.startsWith('%PDF-')).toBe(true)
  expect(contents).toContain('(Expense report)')
  expect(contents).toContain('(Export row 143)')
  expect(contents).toContain('(727.75)')
  expect(contents).toContain('(738.00)')
  expect((contents.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
})

test('exports use current search filters and disable when no records match', async ({ page }, testInfo) => {
  const requests = await openExpenses(page)
  await page.getByRole('searchbox', { name: 'Search expenses' }).fill('Export row 14')
  await expect(page.getByText('5 expenses recorded')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
  const download = await downloadPromise
  const path = testInfo.outputPath('filtered.xlsx')
  await download.saveAs(path)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(path)
  expect(workbook.getWorksheet('Expenses')!.rowCount).toBe(6)
  expect(requests).toHaveLength(1)
  expect(requests[0].get('search')).toBe('Export row 14')
  expect(workbook.getWorksheet('Summary')!.getCell('B6').value).toBe('Search: Export row 14')
  await page.getByRole('searchbox', { name: 'Search expenses' }).fill('no matching expense')
  await expect(page.getByText('No expenses found', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Export PDF', exact: true })).toBeDisabled()
})

for (const failure of ['request', 'changed'] as const) {
  test('prevents partial downloads when a later page ' + failure + ' fails', async ({ page }) => {
    await openExpenses(page, failure)
    const downloads: string[] = []
    page.on('download', (download) => downloads.push(download.suggestedFilename()))
    await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(
      failure === 'request' ? 'Export service unavailable' : 'Expenses changed while exporting',
    )
    await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled()
    expect(downloads).toEqual([])
  })
}