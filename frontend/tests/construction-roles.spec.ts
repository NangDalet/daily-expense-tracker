import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, role: 'super' | 'manager' | 'foreman') {
  await page.clock.setFixedTime(new Date('2026-10-11T05:00:00Z'))
  const user = { id: 'actor', username: role, roles: role === 'super' ? ['SUPER_ADMIN'] : ['USER'], enabled: true }
  await page.addInitScript(user => {
    localStorage.setItem('expense-tracker.accessToken', 'token')
    localStorage.setItem('expense-tracker.refreshToken', 'refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify(user))
    localStorage.setItem('expense-tracker.language', 'en')
  }, user)
  const projects = [{ id: 'a1', name: 'Project A', site: 'A1', active: true }, { id: 'b2', name: 'Project B', site: 'B2', active: true }]
  const worker = { id: 'w1', workerCode: 'A1-01', fullName: 'A1 Worker', position: 'Mason', projectId: 'a1', rateType: 'DAILY', rate: 40000, overtimeRate: 5000, hoursPerDay: 8, currency: 'KHR', startDate: '2026-01-01', active: true }
  let grant = { userId: 'foreman-user', username: 'foreman-user', fullName: 'Site Foreman', enabled: true, granted: false, constructionRole: undefined as string | undefined, siteIds: [] as string[] }
  let attendance: Record<string, unknown>[] = [{ id: 'locked', workerId: 'w1', projectId: 'a1', workDate: '2026-10-01', kind: 'FULL', hours: 8, workdays: 1, overtimeHours: 0, payrollId: 'paid-payroll' }]
  const savedUsers: Record<string, unknown>[] = [], savedGrants: Record<string, unknown>[] = [], savedAttendance: Record<string, unknown>[] = [], reads: string[] = []
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/v1', '')
    const method = route.request().method()
    let data: unknown = []
    if (method === 'GET') reads.push(path)
    if (path === '/construction/access') data = { allowed: true, superAdmin: role === 'super', manager: role !== 'foreman', constructionRole: role === 'foreman' ? 'FOREMAN' : 'MANAGER', siteIds: role === 'foreman' ? ['a1'] : [] }
    if (path === '/construction/projects') data = role === 'foreman' ? projects.slice(0, 1) : projects
    if (path === '/construction/workers') data = [worker]
    if (path === '/construction/grants') data = [grant]
    if (path === '/construction/grants/foreman-user' && method === 'PUT') {
      const body = route.request().postDataJSON()
      savedGrants.push(body)
      grant = { ...grant, ...body }
    }
    if (path === '/construction/attendance' && method === 'GET') data = attendance
    if (path.startsWith('/construction/attendance') && ['POST', 'PUT'].includes(method)) {
      const body = route.request().postDataJSON()
      savedAttendance.push(body)
      const id = method === 'POST' ? 'new-attendance' : path.split('/').at(-1)
      const hours = body.kind === 'FULL' ? 8 : body.kind === 'HALF' ? 4 : body.hours
      data = { ...body, id, hours, workdays: hours / 8 }
      attendance = [...attendance.filter(row => row.id !== id), data as Record<string, unknown>]
    }
    if (path.startsWith('/construction/attendance/') && method === 'DELETE') attendance = attendance.filter(row => row.id !== path.split('/').at(-1))
    if (path === '/users' && method === 'POST') {
      savedUsers.push(route.request().postDataJSON())
      data = { id: 'created', ...savedUsers.at(-1) }
    }
    await route.fulfill({ status: path === '/users' && method === 'POST' ? 201 : 200, json: { data, page: 0, size: 20, totalElements: 0, totalPages: 0 } })
  })
  return { savedUsers, savedGrants, savedAttendance, reads }
}

test('super administrator assigns Construction Site Manager during user creation', async ({ page }) => {
  const state = await setup(page, 'super')
  await page.goto('/users')
  await page.getByRole('button', { name: 'New user', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Username').fill('site-manager')
  await dialog.getByLabel('E-mail').fill('site-manager@example.com')
  await dialog.getByLabel('Password', { exact: false }).fill('Manager-pass-123!')
  await dialog.getByLabel('Construction access').selectOption('MANAGER')
  await dialog.getByRole('button', { name: 'Create user', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.savedUsers[0]).toMatchObject({ username: 'site-manager', roles: ['USER'], constructionRole: 'MANAGER' })
})

test('site manager assigns a foreman to selected sites and revokes access', async ({ page }) => {
  const state = await setup(page, 'manager')
  await page.goto('/construction')
  await page.getByRole('tab', { name: 'Access', exact: true }).click()
  await expect(page.getByRole('option', { name: 'Construction Site Manager', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeDisabled()
  await page.getByLabel('Project A / A1', { exact: true }).check()
  await page.getByRole('button', { name: 'Assign', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Update access', exact: true })).toBeVisible()
  expect(state.savedGrants[0]).toEqual({ granted: true, constructionRole: 'FOREMAN', siteIds: ['a1'] })
  await page.getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Assign', exact: true })).toBeVisible()
  expect(state.savedGrants[1]).toEqual({ granted: false, constructionRole: 'FOREMAN', siteIds: [] })
})

test('foreman records and edits assigned-site attendance without finance or access requests', async ({ page }) => {
  const state = await setup(page, 'foreman')
  await page.goto('/construction')
  await expect(page.getByRole('heading', { name: 'Worker attendance', exact: true })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(1)
  await expect(page.getByRole('tab', { name: 'Attendance', exact: true })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: '2026-10-01' }).getByRole('button')).toHaveCount(0)
  await page.getByRole('button', { name: 'Record attendance', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Worker', { exact: false }).selectOption('w1')
  await expect(dialog.getByLabel('Project / site')).toHaveValue('a1')
  await expect(dialog.getByRole('option', { name: 'Project B / B2' })).toHaveCount(0)
  await dialog.getByLabel('Work type').selectOption('HALF')
  await dialog.getByLabel('Overtime hours').fill('1')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.savedAttendance[0]).toMatchObject({ workerId: 'w1', projectId: 'a1', kind: 'HALF', overtimeHours: 1 })
  const row = page.getByRole('row').filter({ hasText: '2026-10-11' })
  await row.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(dialog.locator('select[name="workerId"]')).toHaveCount(0)
  await dialog.getByLabel('Work type').selectOption('HOURLY')
  await dialog.getByLabel('Regular hours (hourly work only)').fill('3')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.savedAttendance[1]).toMatchObject({ workerId: 'w1', projectId: 'a1', kind: 'HOURLY', hours: 3 })
  expect(state.reads.some(path => /payrolls|adjustments|grants/.test(path))).toBe(false)
})
