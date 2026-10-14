import { expect, test } from '@playwright/test'

const browser = process.env.PHONE_TEST_BROWSER === 'webkit' ? 'webkit' : 'chromium'
test.use({ browserName: browser, channel: browser === 'webkit' ? '' : (process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined)) })

  test.describe(browser, () => {

    for (const width of [320, 390, 430, 1440]) {
      for (const language of ['en', 'km']) {
        test(`month and currency filters fit at ${width}px in ${language}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 })
          await page.clock.setFixedTime(new Date('2026-10-14T05:00:00Z'))
          await page.addInitScript(language => {
            localStorage.setItem('expense-tracker.language', language)
            localStorage.setItem('expense-tracker.theme', 'dark')
            localStorage.setItem('expense-tracker.accessToken', 'test-access')
            localStorage.setItem('expense-tracker.refreshToken', 'test-refresh')
            localStorage.setItem('expense-tracker.user', JSON.stringify({
              id: 'test-user', username: 'Nang', roles: ['USER'], enabled: true,
            }))
          }, language)
          await page.route('**/api/v1/**', route => route.fulfill({ json: {
            data: [], page: 0, size: 100, totalElements: 0, totalPages: 0,
          } }))

          for (const path of ['/', '/monthly']) {
            await page.goto(path)
            const month = page.locator('input[type=month]')
            const currency = page.locator(path === '/' ? '#dashboard-currency' : '#monthly-currency')
            await expect(month).toHaveValue('2026-10', { timeout: 20000 })
            await expect(currency).toBeVisible()
            const bounds = await month.evaluate((input, currencyId) => {
              const select = document.querySelector<HTMLElement>(currencyId)!
              const controls = [input, select]
              const rects = controls.map(control => control.getBoundingClientRect())
              return {
                separate: rects[0].right <= rects[1].left || rects[1].right <= rects[0].left
                  || rects[0].bottom <= rects[1].top || rects[1].bottom <= rects[0].top,
                contained: controls.every(control => {
                  const rect = control.getBoundingClientRect()
                  const field = control.closest('.space-y-1\\.5')!
                  const container = field.getBoundingClientRect()
                  const label = field.querySelector('label')!.getBoundingClientRect()
                  return rect.left >= container.left - 1 && rect.right <= container.right + 1
                    && rect.left >= 0 && rect.right <= innerWidth && label.bottom <= rect.top
                    && control === document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
                }),
                noOverflow: document.documentElement.scrollWidth <= innerWidth,
              }
            }, path === '/' ? '#dashboard-currency' : '#monthly-currency')
            expect(bounds).toEqual({ separate: true, contained: true, noOverflow: true })
            await currency.selectOption('KHR')
            await expect(currency).toHaveValue('KHR')
            await month.fill('2026-09')
            await expect(month).toHaveValue('2026-09')
            await month.locator('..').getByRole('button').click()
            await expect(page.getByRole('dialog')).toBeVisible()
            await page.keyboard.press('Escape')
            await expect(page.getByRole('dialog')).toHaveCount(0)
          }
        })
      }
    }
  })
