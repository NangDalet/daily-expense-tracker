import { expect, test, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const worker = { id: 'w1', workerCode: 'CW-01', fullName: 'សុខ ដារ៉ា', phone: '012345678', position: 'Mason', rateType: 'DAILY', rate: 20, overtimeRate: 4, hoursPerDay: 8, currency: 'KHR', startDate: '2026-01-01', active: true, projectId: 'p1' }
const project = { id: 'p1', name: 'House', site: 'Phnom Penh', active: true }
const payroll = { id: 'pr1', reference: 'CW-test-001', workerId: 'w1', projectId: 'p1', workerName: worker.fullName, workerCode: worker.workerCode, fromDate: '2026-10-01', toDate: '2026-10-07', period: 'WEEKLY', currency: 'KHR', rateType: 'DAILY', rate: 20, workdays: 5.5, hours: 44, overtimeHours: 2, baseWages: 110, overtime: 8, bonuses: 5, allowances: 2, advances: 20, deductions: 5, netPay: 100, paidAmount: 40, status: 'PARTIALLY_PAID', createdBy: 'user', createdAt: '2026-10-07' }
async function setup(page: Page, allowed = true, superAdmin = false) {
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'token'); localStorage.setItem('expense-tracker.refreshToken', 'refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'user', username: 'foreman', roles: ['USER'], enabled: true }))
  })
  const payments: Record<string, unknown>[] = []; const grants: unknown[] = []; const savedWorkers: Record<string, unknown>[] = []; const previews: Record<string, unknown>[] = []
  let currentWorker = { ...worker, photoDataUrl: '' }
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/construction', '')
    let data: unknown = []
    if (path === '/access') data = { allowed, superAdmin }
    else if (path === '/workers' || path === '/workers/w1') {
      if (['POST', 'PUT'].includes(route.request().method())) {
        const body = route.request().postDataJSON(); savedWorkers.push(body); currentWorker = { ...currentWorker, ...body }; data = currentWorker
      } else data = path === '/workers/w1' ? currentWorker : [currentWorker]
    }
    else if (path === '/projects') data = [project]
    else if (path === '/attendance') data = [
      { id: 'a1', workerId: 'w1', projectId: 'p1', workDate: '2026-09-17', payrollId: null },
      { id: 'a2', workerId: 'w1', projectId: 'p1', workDate: '2026-09-30', payrollId: null },
      { id: 'a3', workerId: 'w1', projectId: 'p1', workDate: '2026-10-10', payrollId: 'already-paid' },
    ]
    else if (path === '/payrolls/preview') { previews.push(route.request().postDataJSON()); data = { ...payroll, paidAmount: 0, status: 'PENDING' } }
    else if (path === '/payrolls') data = route.request().method() === 'POST' ? payroll : [payroll]
    else if (path === '/payrolls/pr1') data = payroll
    else if (path === '/payrolls/pr1/receipt') data = { payroll, project, payments: [{ id: 'payment', reference: 'CWP-test-001', paymentDate: '2026-10-07', amount: 40, method: 'CASH', processorName: 'foreman' }] }
    else if (path === '/grants') data = [{ userId: 'u2', username: 'manager', enabled: true, granted: false }]
    else if (path === '/grants/u2') { grants.push(route.request().postDataJSON()); data = null }
    else if (path === '/payrolls/pr1/payments') {
      if (route.request().method() === 'POST') {
        payments.push(route.request().postDataJSON())
        if (payments.length === 1) { await route.fulfill({ status: 503, json: { message: 'Temporary payment error' } }); return }
        data = { id: 'payment', ...payments.at(-1) }
      } else data = [{ id: 'payment', reference: 'CWP-test-001', paymentDate: '2026-10-07', amount: 40, method: 'CASH', processorName: 'foreman' }]
    }
    await route.fulfill({ json: { data } })
  })
  await page.goto('/construction')
  return { payments, grants, savedWorkers, previews }
}
test('Docker serves fresh HTML and returns 404 for removed build assets', async ({ request }) => {
  test.skip(!process.env.EXPORT_TEST_BASE_URL, 'Requires the built Docker frontend')
  const index = await request.get('/construction')
  expect(index.status()).toBe(200)
  expect(index.headers()['cache-control']).toBe('no-store')
  const html = await index.text()
  const entry = html.match(/src="([^"]*\/assets\/[^\"]+\.js)"/)
  expect(entry).not.toBeNull()
  const asset = await request.get(entry![1])
  expect(asset.status()).toBe(200)
  expect(asset.headers()['cache-control']).toContain('immutable')
  const removed = await request.get('/assets/pdfmake-removed-build.js')
  expect(removed.status()).toBe(404)
  expect(removed.headers()['cache-control'] ?? '').not.toContain('immutable')
})

test('a failed PDF chunk reloads once and PDF export works on retry', async ({ page }) => {
  test.skip(!process.env.EXPORT_TEST_BASE_URL, 'Requires Vite production chunks')
  await setup(page)
  let failed = false
  await page.route('**/assets/pdfmake-*.js', async route => {
    if (!failed) { failed = true; await route.abort('failed') }
    else await route.continue()
  })
  await page.getByRole('tab', { name: 'Reports', exact: true }).click()
  const reloaded = page.waitForEvent('framenavigated', frame => frame === page.mainFrame())
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  await reloaded
  expect(failed).toBe(true)
  await expect(page.getByRole('heading', { name: 'Construction worker payments' })).toBeVisible()
  await page.getByRole('tab', { name: 'Reports', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/)
  // A second failure inside the guard window must stay visible without reloading.
  expect(await page.evaluate(() => {
    const event = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })).toBe(false)
})

test('worker photo is resized, saved, shown in the list and editable', async ({ page }) => {
  const { savedWorkers } = await setup(page)
  const photo = await page.screenshot({ clip: { x: 0, y: 0, width: 640, height: 480 } })
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('Worker photo', { exact: true }).setInputFiles({ name: 'worker.png', mimeType: 'image/png', buffer: photo })
  const preview = dialog.getByRole('img', { name: 'Worker photo preview' })
  await expect(preview).toBeVisible()
  expect(await preview.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([384, 288])
  await dialog.getByLabel(/^Worker ID\s*\*?$/).fill('PHOTO-01')
  await dialog.getByLabel('Full name').fill('Photo worker')
  await dialog.getByLabel('Assigned site').selectOption('p1')
  await expect(dialog.getByLabel('Position / job type')).toHaveValue('Worker')
  await dialog.getByLabel('Daily / hourly / fixed rate').fill('40000')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(savedWorkers[0].photoDataUrl).toMatch(/^data:image\/jpeg;base64,/)
  await expect(page.getByRole('img', { name: 'Photo worker', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View / edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('img', { name: 'Worker photo preview' })).toHaveAttribute('src', String(savedWorkers[0].photoDataUrl))
  await dialog.getByRole('button', { name: 'Remove photo', exact: true }).click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(savedWorkers[1].photoDataUrl).toBe('')
  await expect(page.getByRole('img', { name: 'Photo worker', exact: true })).toHaveCount(0)
})

test('worker photo rejects invalid files and shows Khmer labels', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Worker photo', { exact: true }).setInputFiles({ name: 'worker.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') })
  await expect(dialog.getByRole('alert')).toContainText('Choose a JPG, PNG or WebP image up to 5 MB.')
  await dialog.getByLabel('Worker photo', { exact: true }).setInputFiles({ name: 'large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })
  await expect(dialog.getByRole('alert')).toContainText('Choose a JPG, PNG or WebP image up to 5 MB.')
  await dialog.getByLabel('Worker photo', { exact: true }).setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') })
  await expect(dialog.getByRole('alert')).toContainText('Unable to read this image.')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByLabel('Language / ភាសា').selectOption('km')
  await page.getByRole('button', { name: 'បន្ថែមកម្មករ', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('រូបថតកម្មករ', { exact: true })).toBeVisible()
})

test('worker form fixes currency to KHR and submits only KHR', async ({ page }) => {
  const { savedWorkers } = await setup(page)
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Currency', { exact: true })).toHaveValue('KHR')
  await expect(dialog.getByLabel('Currency', { exact: true })).toHaveAttribute('readonly', '')
  await expect(dialog.getByRole('combobox', { name: /Currency/ })).toHaveCount(0)
  await dialog.getByLabel(/^Worker ID\s*\*?$/).fill('KHR-01')
  await dialog.getByLabel('Full name').fill('KHR worker')
  await dialog.getByLabel('Assigned site').selectOption('p1')
  await expect(dialog.getByLabel('Position / job type')).toHaveValue('Worker')
  await dialog.getByLabel('Daily / hourly / fixed rate').fill('80000')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(savedWorkers[0].currency).toBe('KHR')
  await expect(page.locator('body')).not.toContainText('USD')
})
test('assigned users can prepare payroll and retry a partial payment with the same request key', async ({ page }) => {
  const { payments, previews } = await setup(page)
  await expect(page.getByRole('heading', { name: 'Construction worker payments' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Access', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Payroll', exact: true }).click()
  await page.getByRole('button', { name: 'Prepare payroll', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Worker/).selectOption('w1')
  await dialog.getByLabel(/^Project \/ site/).selectOption('p1')
  await expect(dialog.getByLabel('Payment period')).toHaveValue('CUSTOM')
  await expect(dialog.getByLabel('Period start')).toHaveValue('2026-09-17')
  await expect(dialog.getByLabel('Period end')).toHaveValue('2026-09-30')
  await expect(dialog.getByLabel('Period start')).toBeEnabled()
  await dialog.getByLabel('Period start').fill('2026-09-25')
  await dialog.getByRole('button', { name: 'Use all unpaid worked days', exact: true }).click()
  await expect(dialog.getByLabel('Period start')).toHaveValue('2026-09-17')
  await dialog.getByLabel('Period start').fill('2026-10-01'); await dialog.getByLabel('Period end').fill('2026-10-10')
  await dialog.getByRole('button', { name: 'Calculate / refresh preview' }).click()
  await expect(dialog.getByText('Net payable', { exact: true })).toBeVisible()
  expect(previews[0]).toMatchObject({ period: 'CUSTOM', fromDate: '2026-10-01', toDate: '2026-10-10' })
  await dialog.getByRole('button', { name: 'Create payroll', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('button', { name: 'Pay', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Payment amount').fill('25')
  await dialog.getByRole('button', { name: 'Record payment', exact: true }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Temporary payment error')
  await dialog.getByRole('button', { name: 'Record payment', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(payments).toHaveLength(2); expect(payments[0].requestKey).toBe(payments[1].requestKey); expect(payments[0].amount).toBe(25)
})

test('language switch translates forms and exports, persists on reload, and switches back to English', async ({ page }, info) => {
  await setup(page, true, true)
  await page.getByLabel('Language / ភាសា').selectOption('km')
  await expect(page.getByRole('heading', { name: 'ការទូទាត់ប្រាក់កម្មករសំណង់' })).toBeVisible()
  await page.getByRole('button', { name: 'បន្ថែមកម្មករ', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('រូបិយប័ណ្ណ')).toHaveValue('KHR')
  await page.getByRole('dialog').getByRole('button', { name: 'បិទ', exact: true }).click()
  await page.reload()
  await expect(page.getByLabel('Language / ភាសា')).toHaveValue('km')
  await page.getByRole('tab', { name: 'របាយការណ៍', exact: true }).click()
  let downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Excel', exact: true }).click()
  const xlsx = await downloading; const xlsxPath = info.outputPath('khmer.xlsx'); await xlsx.saveAs(xlsxPath)
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(xlsxPath)
  expect(book.getWorksheet('ការទូទាត់កម្មករ')!.getCell('A1').value).toBe('លេខយោង')
  expect(book.getWorksheet('សង្ខេប')!.getCell('D3').value).toBe(60)
  downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF', exact: true }).click()
  const report = await downloading; const path = info.outputPath('khmer.pdf'); await report.saveAs(path)
  const loading = getDocument({ data: new Uint8Array(await readFile(path)), useSystemFonts: false })
  const document = await loading.promise
  const content = await (await document.getPage(1)).getTextContent()
  const text = content.items.map(x => 'str' in x ? x.str : '').join(' ')
  expect(text).toContain('របាយការណ៍'); expect(text).toContain('60.00')
  await loading.destroy()
  downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'បង្កាន់ដៃ', exact: true }).click()
  const receipt = await downloading; const receiptPath = info.outputPath('khmer-receipt.pdf'); await receipt.saveAs(receiptPath)
  const receiptLoading = getDocument({ data: new Uint8Array(await readFile(receiptPath)), useSystemFonts: false })
  const receiptDocument = await receiptLoading.promise
  const receiptText = (await (await receiptDocument.getPage(1)).getTextContent()).items.map(x => 'str' in x ? x.str : '').join(' ')
  // PDF extraction can reorder Khmer combining marks after glyph shaping.
  expect(receiptText).toContain('កម្មករសំណង់'); expect(receiptText).not.toContain('Construction worker payment receipt')
  expect(receiptText).toContain('foreman'); expect(receiptText).toContain('60.00')
  await receiptLoading.destroy()
  await page.getByRole('tab', { name: 'បញ្ជីប្រាក់ឈ្នួល', exact: true }).click()
  await page.getByRole('button', { name: 'រៀបចំបញ្ជីប្រាក់ឈ្នួល', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('រយៈពេលទូទាត់')).toHaveValue('CUSTOM')
  await page.getByRole('dialog').getByRole('button', { name: 'បិទ', exact: true }).click()
  await page.getByLabel('Language / ភាសា').selectOption('en')
  await expect(page.getByRole('heading', { name: 'Construction worker payments' })).toBeVisible()
})
test('super admins can assign module access', async ({ page }) => {
  const { grants } = await setup(page, true, true)
  await page.getByRole('tab', { name: 'Access', exact: true }).click()
  await page.getByRole('button', { name: 'Assign', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Saved successfully')
  expect(grants).toEqual([{ granted: true, constructionRole: 'MANAGER', siteIds: [] }])
})
test('unassigned users are redirected and the navigation hides the module', async ({ page }) => {
  await setup(page, false)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Construction payments' })).toHaveCount(0)
})
test('reports export typed Excel totals and Khmer PDF text; receipt includes processor and balance', async ({ page }, info) => {
  await setup(page); await page.getByRole('tab', { name: 'Reports' }).click()
  let downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Excel', exact: true }).click()
  const excel = await downloading; const path = info.outputPath('payments.xlsx'); await excel.saveAs(path)
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile(path)
  expect(book.getWorksheet('Worker payments')!.getCell('C2').value).toBe(worker.fullName)
  expect(book.getWorksheet('Worker payments')!.getCell('U2').value).toBe(60)
  expect(book.getWorksheet('Summary')!.getCell('D3').value).toBe(60)
  downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'PDF', exact: true }).click()
  const report = await downloading; const pdfPath = info.outputPath('payments.pdf'); await report.saveAs(pdfPath)
  const loading = getDocument({ data: new Uint8Array(await readFile(pdfPath)), useSystemFonts: false })
  const document = await loading.promise
  const content = await (await document.getPage(1)).getTextContent()
  const text = content.items.map(x => 'str' in x ? x.str : '').join(' ')
  expect(text).toContain('Construction worker payment report'); expect(text).toContain('60.00'); expect(text).toContain('សុខ')
  await loading.destroy()
  downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Receipt', exact: true }).click()
  const receipt = await downloading; const receiptPath = info.outputPath('receipt.pdf'); await receipt.saveAs(receiptPath)
  const receiptLoading = getDocument({ data: new Uint8Array(await readFile(receiptPath)), useSystemFonts: false })
  const receiptDocument = await receiptLoading.promise
  const receiptContent = await (await receiptDocument.getPage(1)).getTextContent()
  expect(receiptContent.items.map(x => 'str' in x ? x.str : '').join(' ')).toContain('foreman')
  await receiptLoading.destroy()
})
