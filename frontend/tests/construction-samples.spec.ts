import { expect, test } from '@playwright/test'

test.skip(!process.env.CONSTRUCTION_SAMPLE_TESTS, 'Requires the existing Docker sample worker attendance')
test('Khmer sample payroll finds unpaid dates or retains the existing payroll for each worker', async ({ page, request }) => {
  const login = await request.post('/api/v1/auth/login', { data: { username: 'root', password: 'Root@123' } })
  expect(login.status()).toBe(200)
  const tokens = (await login.json()).data
  const headers = { Authorization: `Bearer ${tokens.accessToken}` }
  const workers = (await (await request.get('/api/v1/construction/workers', { headers })).json()).data
  const second = workers.find((w: { workerCode: string }) => w.workerCode === 'DEMO-W02')
  expect(second).toBeTruthy()
  const recorded = (await (await request.get('/api/v1/construction/attendance', { headers,
    params: { workerId: second.id, from: '2026-09-01', to: '2026-09-30' } })).json()).data
  expect(recorded).toHaveLength(14)
  const projectId = recorded[0].projectId
  await page.addInitScript(tokens => {
    localStorage.setItem('expense-tracker.accessToken', tokens.accessToken)
    localStorage.setItem('expense-tracker.refreshToken', tokens.refreshToken)
    localStorage.setItem('expense-tracker.user', JSON.stringify(tokens.user))
  }, tokens)
  await page.goto('/construction')
  await page.getByLabel('Language / ភាសា').selectOption('km')
  await page.getByRole('tab', { name: 'បញ្ជីប្រាក់ឈ្នួល', exact: true }).click()
  for (const sample of [
    { code: 'DOCKER-1791640022447', from: '2026-09-24', days: 7, amount: 280000 },
    { code: 'DEMO-W02', from: '2026-09-17', days: 14, amount: 560000 },
    { code: 'DEMO-W03', from: '2026-09-03', days: 28, amount: 1120000 },
  ]) {
    const worker = workers.find((w: { workerCode: string }) => w.workerCode === sample.code)
    expect(worker).toBeTruthy()
    const attendance = (await (await request.get('/api/v1/construction/attendance', { headers,
      params: { workerId: worker.id, projectId, from: sample.from, to: '2026-09-30' } })).json()).data
    await page.getByRole('button', { name: 'រៀបចំបញ្ជីប្រាក់ឈ្នួល', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('select[name="workerId"]').selectOption(worker.id)
    await dialog.locator('select[name="projectId"]').selectOption(projectId)
    if (attendance.every((a: { payrollId: string | null }) => a.payrollId)) {
      await expect(dialog.getByRole('alert')).toContainText('វត្តមានទាំងអស់បានបញ្ចូលក្នុងបញ្ជីប្រាក់ឈ្នួលរួចហើយ')
      const payrolls = (await (await request.get('/api/v1/construction/payrolls', { headers,
        params: { workerId: worker.id, projectId, from: sample.from, to: '2026-09-30' } })).json()).data
      const existing = payrolls.find((p: { status: string }) => p.status !== 'CANCELLED')
      expect(existing.workdays).toBe(sample.days); expect(existing.netPay).toBe(sample.amount)
      await dialog.getByRole('button', { name: 'បិទ', exact: true }).click()
      continue
    }
    await expect(dialog.locator('input[name="fromDate"]')).toHaveValue(sample.from)
    await expect(dialog.locator('input[name="toDate"]')).toHaveValue('2026-09-30')
    await expect(dialog.locator('input[name="fromDate"]')).toBeEnabled()
    const calculated = page.waitForResponse(response => response.url().endsWith('/construction/payrolls/preview') && response.request().method() === 'POST')
    await dialog.getByRole('button', { name: 'គណនា / ធ្វើបច្ចុប្បន្នភាពការមើលជាមុន', exact: true }).click()
    const response = await calculated
    expect(response.status()).toBe(200)
    const preview = (await response.json()).data
    expect(preview.workdays).toBe(sample.days)
    expect(preview.netPay).toBe(sample.amount)
    await expect(dialog.getByText('ប្រាក់សុទ្ធត្រូវទូទាត់', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'បិទ', exact: true }).click()
  }
})
