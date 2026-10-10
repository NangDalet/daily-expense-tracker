import assert from 'node:assert/strict'
import { test } from 'node:test'
import handler from '../api/backend.js'

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(value) { this.statusCode = value; return this },
    setHeader(name, value) { this.headers[name] = value },
    json(value) { this.body = value },
    end(value) { this.body = value },
  }
}

test('forwards bearer credentials and repeated filters without forwarding preview Origin', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.origin, 'https://daily-expense-tracker-api-mrl6.onrender.com')
    assert.equal(url.pathname, '/api/v1/expenses')
    assert.deepEqual(url.searchParams.getAll('paymentMethods'), ['CASH', 'CARD'])
    assert.equal(url.searchParams.get('search'), 'អាហារ')
    assert.equal(url.searchParams.has('__backendPath'), false)
    assert.equal(options.headers.authorization, 'Bearer test-token')
    assert.equal(options.headers.origin, undefined)
    assert.equal(options.headers.cookie, undefined)
    return new Response('{"data":[]}', { headers: { 'content-type': 'application/json' } })
  })
  const result = response()
  await handler({
    method: 'GET', query: { __backendPath: 'expenses' },
    url: '/api/backend?__backendPath=expenses&paymentMethods=CASH&paymentMethods=CARD&search=' + encodeURIComponent('អាហារ'),
    headers: { authorization: 'Bearer test-token', origin: 'https://preview.vercel.app', cookie: 'unrelated=value' },
  }, result)
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.toString(), '{"data":[]}')
  assert.equal(result.headers['Cache-Control'], 'no-store')
})

test('forwards parsed JSON and preserves backend validation errors', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { description: 'អាហារ', amount: 1.6 })
    assert.equal(options.headers['content-type'], 'application/json')
    return new Response('{"code":"VALIDATION_ERROR"}', { status: 400 })
  })
  const result = response()
  await handler({ method: 'POST', query: { __backendPath: 'expenses' }, url: '/api/backend',
    headers: { 'content-type': 'application/json' }, body: { description: 'អាហារ', amount: 1.6 } }, result)
  assert.equal(result.statusCode, 400)
  assert.equal(result.body.toString(), '{"code":"VALIDATION_ERROR"}')
})

test('preserves unauthorized responses and empty successful deletes', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => new Response(null, {
    status: options.method === 'DELETE' ? 204 : 401,
  }))
  for (const [method, status] of [['GET', 401], ['DELETE', 204]]) {
    const result = response()
    await handler({ method, query: { __backendPath: 'expenses/id' }, url: '/api/backend', headers: {} }, result)
    assert.equal(result.statusCode, status)
    assert.equal(result.body.length, 0)
  }
})

test('rejects paths outside the API before contacting the backend', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected request') })
  for (const path of ['../actuator/health', 'https://example.com', ['expenses'], undefined]) {
    const result = response()
    await handler({ query: { __backendPath: path } }, result)
    assert.equal(result.statusCode, 400)
  }
  assert.equal(fetch.mock.callCount(), 0)
})

test('reports upstream outages without leaking request details', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private request details') })
  const result = response()
  await handler({ method: 'GET', query: { __backendPath: 'expenses' }, url: '/api/backend', headers: {} }, result)
  assert.equal(result.statusCode, 502)
  assert.equal(result.body.code, 'SERVICE_UNAVAILABLE')
  assert.equal(JSON.stringify(result.body).includes('private request details'), false)
})

test('does not send KHR budget writes to a server that ignores currency', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.pathname, '/v3/api-docs')
    return Response.json({ components: { schemas: { BudgetRequest: { properties: { monthlyLimit: {} } } } } })
  })
  for (const [method, path] of [['POST', 'budgets'], ['PUT', 'budgets/test-budget']]) {
    const result = response()
    await handler({ method, query: { __backendPath: path }, url: '/api/backend',
      headers: { 'content-type': 'application/json' }, body: { currency: 'KHR', monthlyLimit: 400000 } }, result)
    assert.equal(result.statusCode, 503)
    assert.match(result.body.message, /KHR budgets are not available/)
  }
  assert.equal(fetch.mock.callCount(), 2)
})

test('forwards KHR budget writes when the server supports currency', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.pathname === '/v3/api-docs') {
      return Response.json({ components: { schemas: { BudgetRequest: { properties: { currency: { type: 'string' } } } } } })
    }
    assert.equal(url.pathname, '/api/v1/budgets')
    assert.equal(JSON.parse(options.body).currency, 'KHR')
    return Response.json({ data: { id: 'budget', currency: 'KHR', monthlyLimit: 400000 } })
  })
  const result = response()
  await handler({ method: 'POST', query: { __backendPath: 'budgets' }, url: '/api/backend',
    headers: { 'content-type': 'application/json' }, body: { currency: 'KHR', monthlyLimit: 400000 } }, result)
  assert.equal(result.statusCode, 200)
  assert.equal(JSON.parse(result.body.toString()).data.currency, 'KHR')
  assert.equal(fetch.mock.callCount(), 2)
})
