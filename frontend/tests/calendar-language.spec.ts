import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T05:00:00Z'))
  await page.addInitScript(() => {
    localStorage.setItem('expense-tracker.accessToken', 'token')
    localStorage.setItem('expense-tracker.refreshToken', 'refresh')
    localStorage.setItem('expense-tracker.language', 'km')
    localStorage.setItem('expense-tracker.theme', 'dark')
    localStorage.setItem('expense-tracker.user', JSON.stringify({ id: 'manager', username: 'manager', roles: ['USER'], enabled: true }))
  })
  await page.route('**/api/v1/**', route => {
    const access = new URL(route.request().url()).pathname.endsWith('/construction/access')
    return route.fulfill({ json: { data: access ? { allowed: true, manager: true } : [], totalElements: 0, totalPages: 0 } })
  })
})

test('Khmer calendar selects ISO dates, navigates months, supports keyboard and switches back to English', async ({ page }) => {
  await page.goto('/construction')
  const from = page.locator('input[type=date]').first()
  await from.fill('2026-10-01')
  await page.getByRole('button', { name: 'បើកប្រតិទិន', exact: true }).first().click()
  const calendar = page.getByRole('dialog', { name: 'ប្រតិទិន', exact: true })
  await expect(calendar.getByLabel('ខែប្រតិទិន').locator('option:checked')).toHaveText('តុលា')
  await expect(calendar.getByText('អាទិត្យ', { exact: true })).toBeVisible()
  await expect(calendar.getByText('សម្អាត', { exact: true })).toBeVisible()
  expect(await calendar.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(20, 32, 51, 0.96)')
  const dayName = '១៥ តុលា ២០២៦'
  await calendar.getByRole('button', { name: dayName, exact: true }).click()
  await expect(from).toHaveValue('2026-10-15')
  await page.getByRole('button', { name: 'បើកប្រតិទិន', exact: true }).first().click()
  await calendar.getByRole('button', { name: 'ខែបន្ទាប់', exact: true }).click()
  await expect(calendar.getByLabel('ខែប្រតិទិន')).toHaveValue('10')
  await calendar.getByRole('button', { name: 'ថ្ងៃនេះ', exact: true }).click()
  await expect(from).toHaveValue('2026-10-11')
  await page.getByLabel('ភាសា', { exact: true }).selectOption('en')
  await page.getByRole('button', { name: 'Open calendar', exact: true }).first().click()
  const english = page.getByRole('dialog', { name: 'Calendar', exact: true })
  await expect(english.getByLabel('Calendar month').locator('option:checked')).toHaveText('October')
  await english.getByRole('button', { name: 'October 11, 2026', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(from).toHaveValue('2026-10-12')
})

test('calendar Escape keeps the expense modal open and selected dates update form registration', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined
  await page.route('**/api/v1/expenses', async route => {
    if (route.request().method() !== 'POST') { await route.fallback(); return }
    submitted = route.request().postDataJSON()
    await route.fulfill({ json: { data: { id: 'expense', ...submitted } } })
  })
  await page.goto('/expenses?new=1')
  const form = page.getByRole('dialog').first()
  await form.locator('input[type=date]').fill('2026-10-01')
  await form.getByRole('button', { name: 'បើកប្រតិទិន', exact: true }).click()
  const calendar = page.getByRole('dialog', { name: 'ប្រតិទិន', exact: true })
  await expect(calendar).toBeVisible()
  await calendar.getByLabel('ឆ្នាំប្រតិទិន').focus()
  await page.keyboard.press('Tab')
  expect(await calendar.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(calendar).toHaveCount(0)
  await expect(form).toBeVisible()
  await form.getByRole('button', { name: 'បើកប្រតិទិន', exact: true }).click()
  await calendar.getByRole('button', { name: 'ថ្ងៃនេះ', exact: true }).click()
  await expect(form.locator('input[type=date]')).toHaveValue('2026-10-11')
  await form.locator('input[name=amount]').fill('25')
  await form.locator('button[type=submit]').click()
  await expect.poll(() => submitted?.expenseDate).toBe('2026-10-11')
})

test('monthly picker uses Khmer months, honors date limits and retains ISO month values', async ({ page }) => {
  await page.goto('/monthly')
  await page.getByRole('button', { name: 'បើកប្រតិទិន', exact: true }).click()
  const calendar = page.getByRole('dialog', { name: 'ប្រតិទិន', exact: true })
  await calendar.getByRole('button', { name: 'កញ្ញា', exact: true }).click()
  await expect(page.locator('input[type=month]')).toHaveValue('2026-09')
  await page.getByRole('button', { name: 'បើកប្រតិទិន', exact: true }).click()
  await calendar.getByLabel('ឆ្នាំប្រតិទិន').fill('1899')
  await expect(calendar.getByRole('button', { name: 'មករា', exact: true })).toBeDisabled()
})

for (const theme of ['light', 'dark'] as const) {
  for (const mobile of [false, true]) {
    test(`monthly calendar stays above glass cards in ${theme} mode on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
      await page.addInitScript(theme => localStorage.setItem('expense-tracker.theme', theme), theme)
      await page.goto('/monthly')
      await page.getByRole('button', { name: 'បើកប្រតិទិន', exact: true }).click()
      const calendar = page.getByRole('dialog', { name: 'ប្រតិទិន', exact: true })
      await expect(calendar).toBeVisible()
      const popup = await calendar.evaluate(panel => {
        const rect = panel.getBoundingClientRect()
        const points = [[rect.left + 8, rect.top + 8], [rect.right - 8, rect.bottom - 8],
          [rect.left + rect.width / 2, rect.top + rect.height / 2]]
        return { insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
          unobstructed: points.every(([x, y]) => panel.contains(document.elementFromPoint(x, y))) }
      })
      expect(popup).toEqual({ insideViewport: true, unobstructed: true })
      await calendar.getByRole('button', { name: 'កញ្ញា', exact: true }).click()
      await expect(page.locator('input[type=month]')).toHaveValue('2026-09')
      await expect(calendar).toHaveCount(0)
    })
  }
}
