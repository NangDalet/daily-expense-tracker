import { expect, test, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const user = { id: 'language-user', username: 'nang', fullName: 'Nang Dalet', email: 'nang@example.com', roles: ['SUPER_ADMIN'], enabled: true }
const expense = { id: 'expense-1', amount: 12.5, currency: 'USD', description: 'My original description', expenseDate: '2026-10-11', paymentMethod: 'CASH', tags: [] }

async function setup(page: Page) {
  await page.addInitScript(value => {
    localStorage.setItem('expense-tracker.accessToken', 'test-access')
    localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify(value))
  }, user)
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path.endsWith('/construction/access')) data = { allowed: true, superAdmin: true }
    else if (path.endsWith('/profile')) data = user
    else if (path.endsWith('/telegram')) data = { available: true, connected: false }
    else if (path.endsWith('/expenses')) data = [expense]
    await route.fulfill({ json: { data, page: 0, size: 20, totalElements: path.endsWith('/expenses') ? 1 : 0, totalPages: 1 } })
  })
}

test('language changes on sign-in and registration, preserves inputs, and survives reload', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username or e-mail').fill('keep-my-username')
  await page.getByLabel('Language', { exact: true }).selectOption('km')
  await expect(page.locator('html')).toHaveAttribute('lang', 'km')
  await expect(page.getByRole('heading', { name: 'សូមស្វាគមន៍ការត្រឡប់មកវិញ' })).toBeVisible()
  await expect(page.getByLabel('ឈ្មោះអ្នកប្រើប្រាស់ ឬអ៊ីមែល')).toHaveValue('keep-my-username')
  await page.getByRole('button', { name: 'ចូលគណនី', exact: true }).click()
  await expect(page.getByText('ត្រូវបញ្ចូលពាក្យសម្ងាត់', { exact: true })).toBeVisible()
  await page.getByLabel('ភាសា', { exact: true }).selectOption('en')
  await expect(page.getByText('Password is required', { exact: true })).toBeVisible()
  await page.getByLabel('Language', { exact: true }).selectOption('km')
  await page.reload()
  await expect(page.getByLabel('ភាសា', { exact: true })).toHaveValue('km')
  await page.getByRole('link', { name: 'បង្កើតគណនី', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'បង្កើតគណនីរបស់អ្នក' })).toBeVisible()
})

test('all application routes share the Khmer preference, including construction and admin', async ({ page }) => {
  await setup(page)
  await page.goto('/monthly')
  await page.getByLabel('Planned income (USD)').fill('125.50')
  await page.getByLabel('Language', { exact: true }).selectOption('km')
  await expect(page.getByLabel('ចំណូលតាមគម្រោង (USD)')).toHaveValue('125.50')
  const routes = [
    ['/expenses', 'ចំណាយ'], ['/incomes', 'ចំណូល'], ['/categories', 'ប្រភេទ'], ['/budgets', 'ថវិកា'],
    ['/telegram', 'ការជូនដំណឹង Telegram'], ['/profile', 'ប្រវត្តិរូបរបស់ខ្ញុំ'], ['/users', 'អ្នកប្រើប្រាស់'],
    ['/construction', 'ការទូទាត់ប្រាក់កម្មករសំណង់'], ['/', 'សូមស្វាគមន៍ការត្រឡប់មកវិញ Nang'],
  ]
  for (const [path, heading] of routes) {
    await page.goto(path)
    await expect(page.locator('main').getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.locator('header').getByLabel('ភាសា', { exact: true })).toHaveValue('km')
  }
  await expect(page.locator('aside').getByRole('link', { name: 'គណនាប្រចាំខែ', exact: true })).toBeVisible()
  await page.goto('/construction')
  await page.getByLabel('Language / ភាសា').selectOption('en')
  await expect(page.locator('header').getByLabel('Language', { exact: true })).toHaveValue('en')
  await expect(page.locator('main').getByRole('heading', { name: 'Construction worker payments' })).toBeVisible()
})

test('Khmer expense form submits original API values and preserves user content', async ({ page }) => {
  await setup(page)
  let submitted: Record<string, unknown> | undefined
  await page.route('**/api/v1/expenses', async route => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON()
      await route.fulfill({ json: { data: { ...expense, ...submitted } } })
    } else await route.fulfill({ json: { data: [expense], page: 0, size: 20, totalElements: 1, totalPages: 1 } })
  })
  await page.goto('/expenses')
  await page.getByLabel('Language', { exact: true }).selectOption('km')
  await expect(page.getByText(expense.description, { exact: true }).first()).toBeVisible()
  await page.locator('main').getByRole('button', { name: 'បន្ថែមចំណាយ', exact: true }).click()
  await page.getByRole('dialog').getByLabel('ចំនួនប្រាក់').fill('25.75')
  await page.getByLabel('ការពិពណ៌នា', { exact: true }).fill('Untouched English and ខ្មែរ')
  await page.getByLabel('វិធីទូទាត់', { exact: true }).selectOption('BANK_TRANSFER')
  await page.getByRole('dialog').getByLabel('ភាសា', { exact: true }).selectOption('en')
  await expect(page.getByRole('dialog').getByLabel('Amount')).toHaveValue('25.75')
  await expect(page.getByLabel('Payment method', { exact: true })).toHaveValue('BANK_TRANSFER')
  await page.getByRole('dialog').getByLabel('Language', { exact: true }).selectOption('km')
  await page.getByRole('dialog').locator('button[type="submit"]').click()
  await expect.poll(() => submitted).toMatchObject({ amount: 25.75, currency: 'USD', paymentMethod: 'BANK_TRANSFER', description: 'Untouched English and ខ្មែរ' })
})

test('Khmer export headers render in Excel and PDF while data stays unchanged', async ({ page }) => {
  await setup(page)
  await page.goto('/expenses')
  await page.getByLabel('Language', { exact: true }).selectOption('km')
  const excelDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'នាំចេញ Excel', exact: true }).click()
  const excel = new ExcelJS.Workbook()
  await excel.xlsx.readFile((await (await excelDownload).path())!)
  expect(excel.worksheets[0].getCell('A1').value).toBe('កាលបរិច្ឆេទ')
  expect(excel.worksheets[0].getCell('B2').value).toBe(expense.description)
  const pdfDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'នាំចេញ PDF', exact: true }).click()
  const loadingTask = getDocument({ data: new Uint8Array(await readFile((await (await pdfDownload).path())!)), useSystemFonts: true })
  const document = await loadingTask.promise
  const content = await (await document.getPage(1)).getTextContent()
  const text = content.items.map(item => 'str' in item ? item.str : '').join(' ')
  expect(text).toContain('របាយការណ៍ចំណាយ')
  expect(text).toContain(expense.description)
  await loadingTask.destroy()
})
