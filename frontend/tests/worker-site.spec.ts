import { expect, test, type Page } from '@playwright/test'

const projects = [{ id: 'site-a1', name: 'Project A', site: 'A1', active: true }, { id: 'site-b2', name: 'Project B', site: 'B2', active: true }]
const existing = { id: 'existing-worker', workerCode: 'B2-01', fullName: 'B2 Worker', position: 'Mason', phone: '', rateType: 'DAILY', rate: 40000, overtimeRate: 0, hoursPerDay: 8, currency: 'KHR', startDate: '2026-01-01', active: true, projectId: 'site-b2', idCardDataUrl: '', photoDataUrl: '', hasIdCard: false }

async function setup(page: Page) {
  const workers = [{ ...existing }]
  const submitted: Record<string, unknown>[] = []
  const detailReads: string[] = []
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'token')
    localStorage.setItem('expense-tracker.refreshToken', 'refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'user', username: 'foreman', roles: ['USER'], enabled: true }))
  })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/construction', '')
    let data: unknown = []
    if (path === '/access') data = { allowed: true, superAdmin: false }
    if (path === '/projects') data = projects
    if (path === '/workers' && route.request().method() === 'GET') data = workers.map(({ idCardDataUrl: _card, ...worker }) => worker)
    if (path.startsWith('/workers/') && route.request().method() === 'GET') {
      detailReads.push(path)
      data = workers.find(worker => worker.id === path.split('/').at(-1))
    }
    if (path.startsWith('/workers') && ['POST', 'PUT'].includes(route.request().method())) {
      const body = route.request().postDataJSON()
      submitted.push(body)
      const id = path === '/workers' ? 'new-worker' : path.split('/').at(-1)!
      const saved = { ...existing, ...body, id, hasIdCard: Boolean(body.idCardDataUrl) }
      const index = workers.findIndex(worker => worker.id === id)
      if (index >= 0) workers[index] = saved
      else workers.push(saved)
      data = saved
    }
    await route.fulfill({ json: { data } })
  })
  await page.goto('/construction')
  return { submitted, detailReads }
}

async function cardImage(page: Page) {
  return Buffer.from(await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1100
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'; context.fillRect(0, 0, 1800, 1100)
    context.fillStyle = '#111'; context.font = '80px sans-serif'; context.fillText('SAMPLE ID CARD', 120, 180)
    return canvas.toDataURL('image/png').split(',')[1]
  }), 'base64')
}

test('worker-only position and automatic overtime recalculate and submit correctly', async ({ page }) => {
  const { submitted } = await setup(page)
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const position = dialog.getByLabel('Position / job type')
  await expect(position).toHaveValue('Worker')
  await expect(position).toHaveAttribute('readonly', '')
  await dialog.getByLabel(/^Worker ID\s*\*?$/).fill('AUTO-01')
  await dialog.getByLabel('Full name').fill('Automatic worker')
  await dialog.getByLabel('Assigned site').selectOption('site-a1')
  const wage = dialog.getByLabel('Daily / hourly / fixed rate')
  const overtime = dialog.getByLabel('Overtime rate per hour')
  const hours = dialog.getByLabel('Regular hours per day')
  await wage.fill('60000')
  await expect(overtime).toHaveValue('11250.00')
  await expect(overtime).toHaveAttribute('readonly', '')
  await hours.fill('10')
  await expect(overtime).toHaveValue('9000.00')
  await dialog.getByLabel('Wage basis').selectOption('HOURLY')
  await wage.fill('7500')
  await expect(overtime).toHaveValue('11250.00')
  await wage.fill('0.01')
  await expect(overtime).toHaveValue('0.02')
  await dialog.getByLabel('Wage basis').selectOption('FIXED')
  await expect(overtime).toBeEditable()
  await overtime.fill('2000')
  await dialog.getByLabel('Wage basis').selectOption('DAILY')
  await wage.fill('60000')
  await hours.fill('8')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted[0]).toMatchObject({ position: 'Worker', rate: 60000, hoursPerDay: 8, overtimeRate: 11250 })
  await page.getByRole('row').filter({ hasText: 'Automatic worker' }).getByRole('button', { name: 'View / edit' }).click()
  await expect(page.getByRole('dialog').getByLabel('Overtime rate per hour')).toHaveValue('11250.00')
  await page.getByRole('dialog').getByLabel('Daily / hourly / fixed rate').fill('80000')
  await expect(page.getByRole('dialog').getByLabel('Overtime rate per hour')).toHaveValue('15000.00')
})

test('Khmer worker form translates the automatic calculation and position', async ({ page }) => {
  await setup(page)
  await page.getByLabel('Language / ភាសា').selectOption('km')
  await page.getByRole('button', { name: 'បន្ថែមកម្មករ', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('input[name="position"]')).toHaveValue('Worker')
  await expect(dialog.getByText('គណនាស្វ័យប្រវត្តិ៖ ប្រាក់ឈ្នួលប្រចាំថ្ងៃ ÷ ម៉ោងធ្វើការធម្មតាក្នុងមួយថ្ងៃ × 1.5។')).toBeVisible()
  await dialog.locator('input[name="rate"]').fill('60000')
  await expect(dialog.locator('input[name="overtimeRate"]')).toHaveValue('11250.00')
})

test('creates workers in the selected site and persists, replaces, and removes their ID cards', async ({ page }) => {
  const { submitted, detailReads } = await setup(page)
  await page.getByLabel('Project / construction site').selectOption('site-a1')
  await expect(page.getByRole('table').getByText('B2 Worker', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add worker', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Assigned site')).toHaveValue('site-a1')
  await dialog.getByLabel(/^Worker ID\s*\*?$/).fill('A1-01')
  await dialog.getByLabel('Full name').fill('A1 Worker')
  await expect(dialog.getByLabel('Position / job type')).toHaveValue('Worker')
  await dialog.getByLabel('Daily / hourly / fixed rate').fill('45000')
  await dialog.getByLabel('Worker ID card', { exact: true }).setInputFiles({ name: 'id-card.png', mimeType: 'image/png', buffer: await cardImage(page) })
  const preview = dialog.getByAltText('Worker ID card preview')
  await expect(preview).toBeVisible()
  expect(await preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1600)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted[0]).toMatchObject({ projectId: 'site-a1', workerCode: 'A1-01' })
  expect(submitted[0].idCardDataUrl).toMatch(/^data:image\/jpeg;base64,/)
  await expect(page.getByRole('cell', { name: 'Uploaded', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View / edit', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByAltText('Worker ID card preview')).toHaveAttribute('src', String(submitted[0].idCardDataUrl))
  expect(detailReads).toContain('/workers/new-worker')
  await dialog.getByLabel('Assigned site').selectOption('site-b2')
  await dialog.getByLabel('Worker ID card', { exact: true }).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: await cardImage(page) })
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted[1].projectId).toBe('site-b2')
  await expect(page.getByRole('table').getByText('A1 Worker', { exact: true })).toHaveCount(0)
  await page.getByLabel('Project / construction site').selectOption('site-b2')
  await page.getByRole('row').filter({ hasText: 'A1 Worker' }).getByRole('button', { name: 'View / edit' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Remove ID card' }).click()
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submitted[2].idCardDataUrl).toBe('')
  await page.getByRole('row').filter({ hasText: 'A1 Worker' }).getByRole('button', { name: 'View / edit' }).click()
  await expect(page.getByAltText('Worker ID card preview')).toHaveCount(0)
})

test('worker site defaults attendance and payroll, and card fields support Khmer', async ({ page }) => {
  await setup(page)
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click()
  await page.getByRole('button', { name: 'Record attendance', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('B2-01 · B2 Worker (KHR)').check()
  await expect(dialog.getByLabel('Project / site')).toHaveValue('site-b2')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('tab', { name: 'Payroll', exact: true }).click()
  await page.getByRole('button', { name: 'Prepare payroll' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Worker', { exact: false }).selectOption('existing-worker')
  await expect(dialog.getByLabel('Project / site')).toHaveValue('site-b2')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('tab', { name: 'Workers', exact: true }).click()
  await page.getByRole('button', { name: 'View / edit' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('Worker ID card', { exact: true }).setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') })
  await expect(dialog.getByRole('alert')).toContainText('Choose a JPG, PNG or WebP image up to 5 MB.')
  await dialog.getByLabel('Language', { exact: true }).selectOption('km')
  await expect(dialog.getByLabel('អត្តសញ្ញាណបណ្ណកម្មករ', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('ការដ្ឋានដែលបានកំណត់')).toHaveValue('site-b2')
})
