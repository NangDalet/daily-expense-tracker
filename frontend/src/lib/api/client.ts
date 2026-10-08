import type { ApiErrorBody, ApiErrorCode, ApiResponse, TokenResponse } from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

const ACCESS_TOKEN_KEY = 'expense-tracker.accessToken'
const REFRESH_TOKEN_KEY = 'expense-tracker.refreshToken'

export const tokenStorage = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },
  set(tokens: Pick<TokenResponse, 'accessToken' | 'refreshToken'>) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

/**
 * Error carrying the backend `ErrorCode` plus any field level details, so call
 * sites can branch on `code` instead of matching on message strings.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN'
  readonly status: number
  readonly details: ApiErrorBody['details']
  readonly path?: string

  constructor(
    message: string,
    opts: {
      code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN'
      status: number
      details?: ApiErrorBody['details']
      path?: string
    },
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = opts.code
    this.status = opts.status
    this.details = opts.details
    this.path = opts.path
  }

  /** Field level message for a form input, if the backend reported one. */
  fieldError(field: string): string | undefined {
    return this.details?.find((d) => d.field === field)?.message
  }
}

type Listener = () => void

/**
 * Notified whenever the session is established or torn down. Lives in the auth
 * provider so a forced logout (expired refresh token) can react to it.
 */
const sessionListeners = new Set<Listener>()

export function onSessionChange(listener: Listener): () => void {
  sessionListeners.add(listener)
  return () => sessionListeners.delete(listener)
}

function emitSessionChange() {
  for (const listener of sessionListeners) listener()
}

/**
 * Refresh is serialised through a single in-flight promise: a burst of 401s
 * produces one `/auth/refresh` call, and every waiter reuses its result.
 */
let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.refresh
  if (!refreshToken) return null

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })

        if (!response.ok) {
          tokenStorage.clear()
          emitSessionChange()
          return null
        }

        const payload = (await response.json()) as { data: TokenResponse }
        tokenStorage.set(payload.data)
        emitSessionChange()
        return payload.data.accessToken
      } catch {
        tokenStorage.clear()
        emitSessionChange()
        return null
      } finally {
        // Cleared in a microtask so every awaiter of this promise observes the
        // same result before a later request can start a new refresh.
        queueMicrotask(() => {
          refreshInFlight = null
        })
      }
    })()
  }

  return refreshInFlight
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    // Non-JSON error page (proxy timeout, gateway error, ...).
  }

  return new ApiError(
    body?.message ?? response.statusText ?? 'Request failed',
    {
      code: body?.code ?? 'UNKNOWN',
      status: response.status,
      details: body?.details,
      path: body?.path,
    },
  )
}

export type QueryValue = string | number | boolean | undefined | null | (string | number)[]
export type QueryParams = Record<string, QueryValue>

function buildQuery(params?: QueryParams): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      // `paymentMethods` is accepted both repeated and comma separated.
      if (value.length > 0) search.append(key, value.join(','))
    } else {
      search.append(key, String(value))
    }
  }
  const serialised = search.toString()
  return serialised ? `?${serialised}` : ''
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  query?: QueryParams
  /** Internal: prevents infinite refresh recursion on the auth endpoints. */
  skipRefresh?: boolean
  signal?: AbortSignal
}

/** Unwraps the `ApiResponse` envelope down to `data`. */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestEnvelope<T>(path, options)).data
}

/** Like {@link request} but keeps the pagination fields of the envelope. */
async function requestEnvelope<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, query, skipRefresh = false, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const accessToken = tokenStorage.access
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError('Cannot reach the server. Is the backend running?', {
      code: 'NETWORK_ERROR',
      status: 0,
    })
  }

  if (response.status === 401 && !skipRefresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return requestEnvelope<T>(path, { ...options, skipRefresh: true })
    }
  }

  if (!response.ok) throw await toApiError(response)

  if (response.status === 204) return { data: undefined as T }

  return (await response.json()) as ApiResponse<T>
}

export const http = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', query, signal }),
  /** Returns the whole envelope, for endpoints that page their results. */
  getEnvelope: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    requestEnvelope<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown, skipRefresh = false) =>
    request<T>(path, { method: 'POST', body, skipRefresh }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
