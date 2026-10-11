import { expect, test } from '@playwright/test'

// Opt in only against the isolated Docker test stack; never a hosted database.
test.skip(!process.env.CONSTRUCTION_LIVE_TESTS, 'Requires the isolated Docker test stack')
test('Docker stack: migration, permissions, payroll, concurrent payments, receipts and cancellation', async ({ page, request }, info) => {
  const login = await request.post('/api/v1/auth/login', { data: { username: 'root', password: 'Root@123' } })
  expect(login.status()).toBe(200)
  const root = (await login.json()).data
  const rootHeaders = { Authorization: `Bearer ${root.accessToken}` }
  const suffix = Date.now().toString()
  const registered = await request.post('/api/v1/auth/register', { data: { username: 'docker-' + suffix, email: suffix + '@docker.example', password: 'Docker-test-123!' } })
  expect(registered.status()).toBe(201)
  const user = (await registered.json()).data
  const headers = { Authorization: `Bearer ${user.accessToken}` }
  expect((await request.get('/api/v1/construction/workers', { headers })).status()).toBe(403)
  expect((await request.put('/api/v1/construction/grants/' + user.user.id, { headers: rootHeaders, data: { granted: true } })).status()).toBe(200)
  // Existing full-module grants migrate to manager access, including foreman assignment.
  expect((await request.get('/api/v1/construction/grants', { headers })).status()).toBe(200)
  async function post(path: string, data: unknown) {
    const response = await request.post('/api/v1/construction' + path, { headers, data })
    expect(response.status(), await response.text()).toBe(200)
    return (await response.json()).data
  }
  const worker = await post('/workers', { workerCode: 'DOCKER-' + suffix, fullName: 'សុខ Docker ' + suffix, position: 'Mason', rateType: 'DAILY', rate: 20, overtimeRate: 4, hoursPerDay: 8, currency: 'KHR', startDate: '2026-01-01', active: true })
  const project = await post('/projects', { name: 'Docker construction ' + suffix, site: 'Test site', active: true })
  const attendance = await post('/attendance', { workerId: worker.id, projectId: project.id, workDate: '2026-01-01', kind: 'HALF', overtimeHours: 2 })
  const advance = await post('/adjustments', { workerId: worker.id, kind: 'ADVANCE', amount: 5, adjustmentDate: '2026-01-01', reason: 'Docker test advance' })
  expect((await request.put(`/api/v1/construction/adjustments/${advance.id}/approval`, { headers, data: { approved: true, reason: 'Verified test advance' } })).status()).toBe(200)
  const body = { workerId: worker.id, projectId: project.id, fromDate: '2026-01-01', toDate: '2026-01-07', period: 'WEEKLY' }
  const preview = await post('/payrolls/preview', body); expect(preview.netPay).toBe(13)
  const payroll = await post('/payrolls', body); expect(payroll.netPay).toBe(13)
  expect((await request.post('/api/v1/construction/payrolls', { headers, data: body })).status()).toBe(409)
  expect((await request.delete('/api/v1/construction/attendance/' + attendance.id, { headers })).status()).toBe(422)
  const keys = [crypto.randomUUID(), crypto.randomUUID()]
  const path = `/payrolls/${payroll.id}/payments`
  const attempts = await Promise.all(keys.map(requestKey => request.post('/api/v1/construction' + path, { headers, data: { requestKey, paymentDate: '2026-01-07', amount: 8, method: 'CASH' } })))
  expect(attempts.map(r => r.status()).sort()).toEqual([200, 422])
  const successful = attempts.findIndex(r => r.status() === 200)
  await post(path, { requestKey: keys[successful], paymentDate: '2026-01-07', amount: 8, method: 'CASH' })
  await post(path, { requestKey: crypto.randomUUID(), paymentDate: '2026-01-07', amount: 5, method: 'QR' })
  const receiptResponse = await request.get(`/api/v1/construction/payrolls/${payroll.id}/receipt`, { headers })
  expect(receiptResponse.status()).toBe(200)
  const receipt = (await receiptResponse.json()).data
  expect(receipt.payroll.status).toBe('PAID'); expect(receipt.payroll.paidAmount).toBe(13); expect(receipt.payments).toHaveLength(2)
  await page.addInitScript(tokens => {
    localStorage.setItem('expense-tracker.accessToken', tokens.accessToken)
    localStorage.setItem('expense-tracker.refreshToken', tokens.refreshToken)
    localStorage.setItem('expense-tracker.user', JSON.stringify(tokens.user))
  }, root)
  await page.goto('/construction')
  await expect(page.getByRole('heading', { name: 'Construction worker payments', exact: true })).toBeVisible()
  await page.getByLabel('From date').fill('2026-01-01'); await page.getByLabel('To date').fill('2026-01-31')
  await page.getByLabel('Worker / payment history').selectOption(worker.id)
  await page.getByRole('tab', { name: 'Payroll', exact: true }).click()
  await expect(page.getByText(payroll.reference, { exact: true })).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Receipt', exact: true }).click()
  const downloaded = await downloading
  expect(downloaded.suggestedFilename()).toBe(payroll.reference + '-receipt.pdf')
  expect(await downloaded.failure()).toBeNull()
  await page.getByLabel('Language / ភាសា').selectOption('km')
  await expect(page.getByRole('heading', { name: 'ការទូទាត់ប្រាក់កម្មករសំណង់', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'បង្កាន់ដៃ', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('construction-khmer.png'), fullPage: true })
  await post('/attendance', { workerId: worker.id, projectId: project.id, workDate: '2026-01-08', kind: 'FULL', overtimeHours: 0 })
  await post('/attendance', { workerId: worker.id, projectId: project.id, workDate: '2026-01-12', kind: 'HALF', overtimeHours: 0 })
  await post('/attendance', { workerId: worker.id, projectId: project.id, workDate: '2026-01-17', kind: 'FULL', overtimeHours: 0 })
  const next = { ...body, fromDate: '2026-01-08', toDate: '2026-01-17', period: 'CUSTOM' }
  const unpaid = await post('/payrolls', next)
  expect(unpaid.workdays).toBe(2.5); expect(unpaid.netPay).toBe(50)
  const cancelled = await post(`/payrolls/${unpaid.id}/cancel`, { reason: 'Docker cancellation test' })
  expect(cancelled.status).toBe('CANCELLED')
  const replacement = await post('/payrolls', next)
  expect(replacement.netPay).toBe(50)
  await post(`/payrolls/${replacement.id}/payments`, { requestKey: crypto.randomUUID(), paymentDate: '2026-01-17', amount: 50, method: 'CASH' })
  expect((await (await request.get(`/api/v1/construction/payrolls/${replacement.id}`, { headers })).json()).data.status).toBe('PAID')
  expect((await request.put('/api/v1/construction/grants/' + user.user.id, { headers: rootHeaders, data: { granted: false } })).status()).toBe(200)
  expect((await request.get('/api/v1/construction/workers', { headers })).status()).toBe(403)
  expect((await request.delete('/api/v1/users/' + user.user.id, { headers: rootHeaders })).status()).toBe(200)
  expect((await request.get('/api/v1/users/' + user.user.id, { headers: rootHeaders })).status()).toBe(404)
  const listedUsers = (await (await request.get('/api/v1/users', { headers: rootHeaders, params: { search: 'docker-' + suffix } })).json()).data
  expect(listedUsers).toHaveLength(0)
  expect((await request.post('/api/v1/auth/login', { data: { username: 'docker-' + suffix, password: 'Docker-test-123!' } })).status()).toBe(403)
  const survivingWorkers = (await (await request.get('/api/v1/construction/workers', { headers: rootHeaders })).json()).data
  expect(survivingWorkers.some((record: { id: string }) => record.id === worker.id)).toBe(true)
})

test('Docker stack: site manager assigns a foreman who records attendance only at assigned sites', async ({ page, request }) => {
  const suffix = Date.now().toString()
  const rootLogin = await request.post('/api/v1/auth/login', { data: { username: 'root', password: 'Root@123' } })
  expect(rootLogin.status()).toBe(200)
  const root = (await rootLogin.json()).data
  const rootHeaders = { Authorization: `Bearer ${root.accessToken}` }
  const managerName = 'manager-' + suffix
  const managerCreated = await request.post('/api/v1/users', { headers: rootHeaders, data: {
    username: managerName, email: managerName + '@docker.example', password: 'Docker-manager-123!', roles: ['USER'], constructionRole: 'MANAGER',
  } })
  expect(managerCreated.status()).toBe(201)
  const managerLogin = await request.post('/api/v1/auth/login', { data: { username: managerName, password: 'Docker-manager-123!' } })
  expect(managerLogin.status()).toBe(200)
  const manager = (await managerLogin.json()).data
  const headers = { Authorization: `Bearer ${manager.accessToken}` }
  const foremanCreated = await request.post('/api/v1/auth/register', { data: { username: 'foreman-' + suffix, email: 'foreman-' + suffix + '@docker.example', password: 'Docker-foreman-123!' } })
  expect(foremanCreated.status()).toBe(201)
  const foreman = (await foremanCreated.json()).data
  const foremanHeaders = { Authorization: `Bearer ${foreman.accessToken}` }
  async function create(path: string, data: unknown) {
    const response = await request.post('/api/v1/construction' + path, { headers, data })
    expect(response.status(), await response.text()).toBe(200)
    return (await response.json()).data
  }
  const site = await create('/projects', { name: 'Assigned ' + suffix, site: 'A1', active: true })
  const other = await create('/projects', { name: 'Other ' + suffix, site: 'B2', active: true })
  const workerData = { workerCode: 'ROLE-A1-' + suffix, fullName: 'Assigned worker ' + suffix, position: 'Mason', rateType: 'DAILY', rate: 40000, overtimeRate: 5000, hoursPerDay: 8, currency: 'KHR', startDate: '2026-01-01', active: true, projectId: site.id }
  const worker = await create('/workers', workerData)
  const otherWorker = await create('/workers', { ...workerData, workerCode: 'ROLE-B2-' + suffix, projectId: other.id })
  const grantPath = '/api/v1/construction/grants/' + foreman.user.id
  expect((await request.put(grantPath, { headers, data: { granted: true, constructionRole: 'FOREMAN', siteIds: [site.id] } })).status()).toBe(200)
  expect((await request.put(grantPath, { headers, data: { granted: true, constructionRole: 'MANAGER' } })).status()).toBe(403)
  expect((await request.get('/api/v1/construction/workers/' + worker.id, { headers: foremanHeaders })).status()).toBe(403)
  expect((await request.get('/api/v1/construction/grants', { headers: foremanHeaders })).status()).toBe(403)
  expect((await request.get('/api/v1/construction/payrolls', { headers: foremanHeaders, params: { from: '2026-01-01', to: '2026-10-11' } })).status()).toBe(403)
  const workers = await request.get('/api/v1/construction/workers', { headers: foremanHeaders })
  expect(workers.status()).toBe(200)
  const scoped = (await workers.json()).data
  expect(scoped.map((row: { id: string }) => row.id)).toEqual([worker.id])
  expect(scoped[0].rate == null).toBe(true)
  const denied = await request.post('/api/v1/construction/attendance', { headers: foremanHeaders, data: { workerId: otherWorker.id, projectId: other.id, workDate: '2026-01-01', kind: 'FULL', overtimeHours: 0 } })
  expect(denied.status()).toBe(403)
  await page.addInitScript(tokens => {
    localStorage.setItem('expense-tracker.accessToken', tokens.accessToken)
    localStorage.setItem('expense-tracker.refreshToken', tokens.refreshToken)
    localStorage.setItem('expense-tracker.user', JSON.stringify(tokens.user))
    localStorage.setItem('expense-tracker.language', 'en')
  }, foreman)
  await page.goto('/construction')
  await expect(page.getByRole('heading', { name: 'Worker attendance', exact: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(1)
  await page.getByRole('button', { name: 'Record attendance', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Worker', { exact: false }).selectOption(worker.id)
  await expect(dialog.getByLabel('Project / site')).toHaveValue(site.id)
  await dialog.getByLabel('Work date').fill('2026-01-01')
  await dialog.getByLabel('Work type').selectOption('HALF')
  await dialog.getByLabel('Overtime hours').fill('1')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const records = await request.get('/api/v1/construction/attendance', { headers: foremanHeaders, params: { from: '2026-01-01', to: '2026-01-31' } })
  expect(records.status()).toBe(200)
  expect((await records.json()).data).toMatchObject([{ workerId: worker.id, projectId: site.id, hours: 4, overtimeHours: 1, recordedBy: foreman.user.id }])
  expect((await request.put(grantPath, { headers, data: { granted: false, constructionRole: 'FOREMAN' } })).status()).toBe(200)
  expect((await request.get('/api/v1/construction/workers', { headers: foremanHeaders })).status()).toBe(403)
})
