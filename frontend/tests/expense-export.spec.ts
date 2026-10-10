import { expect, test, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { readFile } from 'node:fs/promises'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'

const khmerDescription = 'Lunch អាហារថ្ងៃត្រង់ ទិញម្ហូប និងបន្លែ រាំ រោំ វាំ វោំ'
const khmerCategory = 'អាហារ'
const khmerTag = 'ប្រចាំថ្ងៃ'

const expenses = Array.from({ length: 143 }, (_, index) => ({
  id: 'expense-' + index,
  expenseDate: '2026-10-01',
  description: index === 0 ? '=SUM(1,2)' : index === 1 ? 'Café lunch' : index === 2 ? khmerDescription : 'Export row ' + (index + 1),
  amount: 10.25,
  currency: index % 2 === 0 ? 'USD' : 'KHR',
  paymentMethod: 'CASH',
  category: { id: 'food', name: index === 2 ? khmerCategory : 'Food' },
  tags: index === 2 ? [khmerTag, 'test'] : ['test'],
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
  expect(sheet.getCell('B4').value).toBe(khmerDescription)
  expect(sheet.getCell('C4').value).toBe(khmerCategory)
  expect(sheet.getCell('G4').value).toBe(khmerTag + ', test')
  expect(sheet.getCell('B4').font.name).toBe('Khmer OS')
  expect(sheet.getCell('B1').font.name).toBe('Khmer OS')
  expect(sheet.getCell('A2').value).toEqual(new Date('2026-10-01T00:00:00Z'))
  expect(sheet.getCell('E2').value).toBe(10.25)
  expect(sheet.getCell('B144').value).toBe('Export row 143')
  expect(sheet.getCell('H2').value).toBe('https://example.com/receipt')
  const summary = workbook.getWorksheet('Summary')!
  expect(summary.getRow(2).values).toEqual([undefined, 'KHR', 71, 727.75])
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
  const bytes = new Uint8Array(await readFile(path))
  const loading = getDocument({ data: bytes, useSystemFonts: false })
  const pdf = await loading.promise
  expect(pdf.numPages).toBeGreaterThan(1)
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
    const page = await pdf.getPage(index + 1)
    const content = await page.getTextContent()
    return content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ')
  }))
  const text = pages.join(' ')
  expect(text).toContain('Expense report')
  expect(text).toContain('Export row 143')
  expect(text).toContain('727.75')
  expect(text).toContain('738.00')
  expect(text).toContain('Café lunch')
  expect(text).toContain(khmerCategory)
  // Shaping can reorder marks and expand the split vowel "ោ" into "េ" + "ា".
  // Compare components so a missing consonant or mark still fails this check.
  const khmerChars = (value: string) => [...value.replace(/\u17c4/gu, '\u17c1\u17b6')]
    .filter((char) => /[\u1780-\u17ff]/u.test(char)).sort()
  expect(khmerChars(text)).toEqual(khmerChars(khmerDescription + khmerCategory + khmerTag))
  expect(text).not.toContain('\ufffd')
  const firstPage = await pdf.getPage(1)
  const operators = await firstPage.getOperatorList()
  const glyphs = operators.argsArray.flatMap((args, index) => operators.fnArray[index] === OPS.showText
    ? args[0].filter((glyph: { unicode: string }) => typeof glyph === 'object' && /[\u1780-\u17ff]/u.test(glyph.unicode))
    : [])
  expect(glyphs.length).toBeGreaterThan(0)
  expect(glyphs.every((glyph: { isInFont: boolean }) => glyph.isInFont)).toBe(true)
  const rawPdf = (await readFile(path)).toString('latin1')
  expect(rawPdf).toContain('NotoSansKhmer-Regular')
  expect(rawPdf).toContain('/FontFile2')
  expect(rawPdf).toContain('/ToUnicode')
  await loading.destroy()
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

test('Khmer search filters preserve Unicode in both reports', async ({ page }, testInfo) => {
  await openExpenses(page)
  await page.getByRole('searchbox', { name: 'Search expenses' }).fill(khmerCategory)
  await expect(page.getByText('1 expense recorded', { exact: true })).toBeVisible()

  let pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
  const xlsx = await pending
  const xlsxPath = testInfo.outputPath('khmer-filter.xlsx')
  await xlsx.saveAs(xlsxPath)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(xlsxPath)
  expect(workbook.getWorksheet('Expenses')!.getCell('B2').value).toBe(khmerDescription)
  expect(workbook.getWorksheet('Summary')!.getCell('B5').value).toBe('Search: ' + khmerCategory)
  expect(workbook.getWorksheet('Summary')!.getCell('B5').font.name).toBe('Khmer OS')

  pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export PDF', exact: true }).click()
  const pdfDownload = await pending
  const pdfPath = testInfo.outputPath('khmer-filter.pdf')
  await pdfDownload.saveAs(pdfPath)
  const loading = getDocument({ data: new Uint8Array(await readFile(pdfPath)), useSystemFonts: false })
  const pdf = await loading.promise
  const content = await (await pdf.getPage(1)).getTextContent()
  const text = content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ')
  expect(text).toContain('Search:')
  expect(text).toContain(khmerCategory)
  await loading.destroy()
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
