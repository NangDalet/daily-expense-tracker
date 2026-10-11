import { expect, test } from '@playwright/test'

test('project dates and KHR amount save, display duration, reload for editing and can be cleared', async ({ page }) => {
  const projects: Record<string, unknown>[] = []
  const submissions: Record<string, unknown>[] = []
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'token')
    localStorage.setItem('expense-tracker.refreshToken', 'refresh')
    localStorage.setItem('expense-tracker.language', 'en')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'manager', username: 'manager', roles: ['USER'], enabled: true }))
  })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1/construction', '')
    let data: unknown = []
    if (path === '/access') data = { allowed: true, manager: true }
    if (path.startsWith('/projects') && ['POST', 'PUT'].includes(route.request().method())) {
      const body = route.request().postDataJSON()
      submissions.push(body)
      projects[0] = { id: 'planned-site', ...body }
      data = projects[0]
    } else if (path === '/projects') data = projects
    await route.fulfill({ json: { data } })
  })
  await page.goto('/construction')
  await page.getByRole('tab', { name: 'Projects', exact: true }).click()
  await page.getByRole('button', { name: 'Add project / site' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Project name').fill('Building A')
  await dialog.getByLabel('Construction site', { exact: false }).fill('A1')
  await dialog.getByLabel('Project start date').fill('2026-10-11')
  await dialog.getByLabel('Project end date').fill('2026-10-10')
  await dialog.getByLabel('Planned amount (KHR)').fill('1250000.50')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Select a valid date range', { exact: true })).toBeVisible()
  expect(submissions).toHaveLength(0)
  await dialog.getByLabel('Project end date').fill('2026-11-10')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submissions[0]).toMatchObject({ startDate: '2026-10-11', endDate: '2026-11-10', plannedAmount: 1250000.50 })
  await expect(page.getByText('31 days', { exact: true })).toBeVisible()
  await expect(page.getByText('KHR 1,250,000.50', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('tab', { name: 'Projects', exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(dialog.getByLabel('Project start date')).toHaveValue('2026-10-11')
  await expect(dialog.getByLabel('Planned amount (KHR)')).toHaveValue('1250000.5')
  await dialog.getByLabel('Project start date').fill('')
  await dialog.getByLabel('Project end date').fill('')
  await dialog.getByLabel('Planned amount (KHR)').fill('')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(submissions[1]).toMatchObject({ startDate: null, endDate: null, plannedAmount: null })
  await expect(page.getByText('Not set', { exact: true })).toHaveCount(2)
})
