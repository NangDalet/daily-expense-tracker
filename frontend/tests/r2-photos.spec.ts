import { expect, test, type Page } from '@playwright/test'

const owner = '11111111-1111-1111-1111-111111111111'
const workerId = '22222222-2222-2222-2222-222222222222'
const siteId = '55555555-5555-5555-5555-555555555555'
const file = '33333333-3333-3333-3333-333333333333.jpg'
const avatar = `/api/v1/media/profiles/${owner}/${file}`
const workerPhoto = `/api/v1/media/workers/${workerId}/photos/${file}`
const workerCard = `/api/v1/media/workers/${workerId}/id-cards/${file}`
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMioAAAAASUVORK5CYII=', 'base64')

async function setup(page: Page, expire = false) {
  let user = { id: owner, username: 'photo-user', email: 'photo@example.com', roles: ['SUPER_ADMIN', 'USER'], enabled: true, avatarUrl: avatar as string | null }
  let worker = { id: workerId, workerCode: 'CW01', fullName: 'Photo worker', position: 'Worker', rateType: 'DAILY', rate: 60000,
    overtimeRate: 11250, hoursPerDay: 8, currency: 'KHR', startDate: '2026-10-14', active: true,
    photoDataUrl: workerPhoto, idCardDataUrl: workerCard, hasIdCard: true, projectId: siteId }
  const mediaReads: string[] = []
  const uploads: any[] = []
  let refreshes = 0
  await page.addInitScript(user => {
    localStorage.setItem('expense-tracker.language', 'en')
    localStorage.setItem('expense-tracker.accessToken', 'photo-access')
    localStorage.setItem('expense-tracker.refreshToken', 'photo-refresh')
    localStorage.setItem('expense-tracker.user', JSON.stringify(user))
  }, user)
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/v1', '')
    if (path.startsWith('/media/')) {
      expect(url.search).toBe('')
      expect(request.headers().authorization).toMatch(/^Bearer (photo-access|fresh-access)$/)
      mediaReads.push(path)
      if (expire && request.headers().authorization === 'Bearer photo-access') {
        return route.fulfill({ status: 401, json: { code: 'TOKEN_EXPIRED', message: 'Expired' } })
      }
      return route.fulfill({ contentType: 'image/png', body: png })
    }
    if (path === '/auth/refresh') {
      refreshes++
      return route.fulfill({ json: { data: { accessToken: 'fresh-access', refreshToken: 'fresh-refresh', user, expiresIn: 1800 } } })
    }
    if (path === '/profile/photo' && request.method() === 'PUT') {
      uploads.push(request.postDataJSON())
      user = { ...user, avatarUrl: avatar.replace(file, '44444444-4444-4444-4444-444444444444.jpg') }
    }
    if (path === '/profile/photo' && request.method() === 'DELETE') user = { ...user, avatarUrl: null }
    if (path.startsWith('/profile')) return route.fulfill({ json: { data: user } })
    if (path === '/construction/access') return route.fulfill({ json: { data: { allowed: true, superAdmin: true, manager: true, constructionRole: 'MANAGER' } } })
    if (path === '/construction/projects') return route.fulfill({ json: { data: [{ id: siteId, name: 'Photo site', site: 'A1', active: true, status: 'ACTIVE' }] } })
    if (path === '/construction/workers/' + workerId && request.method() === 'PUT') {
      uploads.push(request.postDataJSON())
      worker = { ...worker, ...request.postDataJSON() }
      return route.fulfill({ json: { data: worker } })
    }
    if (path === '/construction/workers/' + workerId) return route.fulfill({ json: { data: worker } })
    if (path === '/construction/workers') return route.fulfill({ json: { data: [{ ...worker, idCardDataUrl: undefined }] } })
    return route.fulfill({ json: { data: [] } })
  })
  return { mediaReads, uploads, refreshes: () => refreshes }
}

test('R2-backed profile photos load with authentication, update after cropping, and can be removed', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/profile')
  await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeEnabled()
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(2)
  await page.getByLabel('Upload profile photo').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByAltText('Profile photo crop preview')).toBeVisible()
  await page.getByRole('button', { name: 'Save photo', exact: true }).click()
  await expect(page.getByText('Your profile photo has been saved.', { exact: true })).toBeVisible()
  expect(state.uploads[0].imageData).toMatch(/^data:image\/jpeg;base64,/)
  await expect.poll(() => state.mediaReads.some(path => path.includes('44444444'))).toBe(true)
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click()
  await expect(page.getByText('Your profile photo has been removed.', { exact: true })).toBeVisible()
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(0)
})

test('worker photo and ID card previews load privately and unchanged references survive editing', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/construction')
  const row = page.getByRole('row').filter({ hasText: 'Photo worker' })
  await expect(row.getByAltText('Photo worker')).toHaveAttribute('src', /^blob:/)
  await row.getByRole('button', { name: 'View / edit', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByAltText('Worker photo preview')).toHaveAttribute('src', /^blob:/)
  await expect(dialog.getByAltText('Worker ID card preview')).toHaveAttribute('src', /^blob:/)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(state.uploads[0]).toMatchObject({ photoDataUrl: workerPhoto, idCardDataUrl: workerCard })
  expect(state.mediaReads.some(path => path.includes('/id-cards/'))).toBe(true)
})

test('private image requests refresh an expired access token without putting it in the URL', async ({ page }) => {
  const state = await setup(page, true)
  await page.goto('/profile')
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(2)
  expect(state.refreshes()).toBeGreaterThan(0)
})
