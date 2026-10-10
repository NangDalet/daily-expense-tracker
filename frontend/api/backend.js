const backend = 'https://daily-expense-tracker-api-mrl6.onrender.com'

/** Keep browser API calls on the frontend origin, including preview deployments. */
export default async function handler(request, response) {
  const path = request.query.__backendPath
  if (typeof path !== 'string' || !/^[A-Za-z0-9/_-]+$/.test(path)) {
    response.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid API path' })
    return
  }

  const url = new URL('/api/v1/' + path, backend)
  const query = new URL(request.url, backend).searchParams
  query.delete('__backendPath')
  url.search = query.toString()

  // Forward API credentials explicitly. A browser Origin header would make
  // Spring reject preview domains, even though this is a server-to-server call.
  const headers = { Accept: 'application/json' }
  for (const name of ['authorization', 'content-type']) {
    if (typeof request.headers[name] === 'string') headers[name] = request.headers[name]
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
    && request.body !== undefined && request.body !== null

  try {
    const signal = AbortSignal.timeout(55_000)
    if (['POST', 'PUT'].includes(request.method) && /^budgets(?:\/[A-Za-z0-9_-]+)?$/.test(path)) {
      const payload = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
      if (payload?.currency === 'KHR') {
        // Older servers ignore this field and silently save riel amounts as USD.
        const schemaResponse = await fetch(new URL('/v3/api-docs', backend), { signal })
        if (!schemaResponse.ok) throw new Error('Could not verify budget currency support')
        const schema = await schemaResponse.json()
        if (!schema.components?.schemas?.BudgetRequest?.properties?.currency) {
          response.setHeader('Cache-Control', 'no-store')
          response.status(503).json({
            code: 'SERVICE_UNAVAILABLE',
            message: 'KHR budgets are not available yet. The service needs to be updated before you can save a KHR budget.',
          })
          return
        }
      }
    }
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody
        ? typeof request.body === 'string' || Buffer.isBuffer(request.body)
          ? request.body : JSON.stringify(request.body)
        : undefined,
      redirect: 'manual',
      signal,
    })
    response.status(upstream.status)
    response.setHeader('Cache-Control', 'no-store')
    for (const name of ['content-type', 'location', 'x-total-count']) {
      const value = upstream.headers.get(name)
      if (value) response.setHeader(name, value)
    }
    response.end(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    response.status(error.name === 'TimeoutError' ? 504 : 502).json({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The server is temporarily unavailable. Please try again shortly.',
    })
  }
}
