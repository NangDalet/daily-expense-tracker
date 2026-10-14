import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/backend.js'

const originalFetch = globalThis.fetch
test.afterEach(() => { globalThis.fetch = originalFetch })
function response() {
  return {
    headers: {}, code: null, body: null,
    status(code) { this.code = code; return this },
    setHeader(name, value) { this.headers[name] = value },
    json(value) { this.body = value },
    end(value) { this.body = value },
  }
}

test('private JPEG routes retain authentication, image Accept, and binary responses', async () => {
  const paths = [
    'media/profiles/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg',
    'media/workers/11111111-1111-1111-1111-111111111111/photos/22222222-2222-2222-2222-222222222222.jpg',
    'media/workers/11111111-1111-1111-1111-111111111111/id-cards/22222222-2222-2222-2222-222222222222.jpg',
  ]
  for (const path of paths) {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    globalThis.fetch = async (url, options) => {
      assert.equal(url.pathname, '/api/v1/' + path)
      assert.equal(options.headers.authorization, 'Bearer test-access')
      assert.equal(options.headers.accept, 'image/jpeg')
      return new Response(bytes, { headers: { 'content-type': 'image/jpeg' } })
    }
    const result = response()
    await handler({ method: 'GET', query: { __backendPath: path }, url: '/api/backend?__backendPath=' + encodeURIComponent(path),
      headers: { authorization: 'Bearer test-access', accept: 'image/jpeg' } }, result)
    assert.equal(result.code, 200)
    assert.equal(result.headers['content-type'], 'image/jpeg')
    assert.deepEqual(result.body, bytes)
  }
})

test('traversal and arbitrary dotted paths never reach the backend', async () => {
  globalThis.fetch = async () => { assert.fail('Invalid path was forwarded') }
  for (const path of ['../actuator', 'media/profiles/../../actuator.jpg', 'users/test.html']) {
    const result = response()
    await handler({ query: { __backendPath: path } }, result)
    assert.equal(result.code, 400)
  }
})
