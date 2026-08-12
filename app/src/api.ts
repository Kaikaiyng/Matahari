export type ApiValidationErrors = Record<string, string[]>

export class ApiError extends Error {
  status: number
  errors?: ApiValidationErrors

  constructor(status: number, message: string, errors?: ApiValidationErrors) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

let csrfBootstrap: Promise<void> | null = null

type RequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return performRequest<T>(path, options, true)
}

async function performRequest<T>(path: string, options: RequestOptions, retryAfterCsrfFailure: boolean): Promise<T> {
  const { body, ...requestOptions } = options
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  const method = (options.method ?? 'GET').toUpperCase()

  if (!isSafeMethod(method)) {
    await ensureCsrfCookie()
    const token = readCookie('XSRF-TOKEN')

    if (token) {
      headers.set('X-XSRF-TOKEN', token)
    }
  }

  const init: RequestInit = {
    ...requestOptions,
    credentials: 'include',
    headers,
  }

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
    init.body = JSON.stringify(body)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init)

  if (response.status === 419 && !isSafeMethod(method) && retryAfterCsrfFailure) {
    await ensureCsrfCookie(true)

    return performRequest<T>(path, options, false)
  }

  const payload = await readJson(response)

  if (!response.ok) {
    const message =
      response.status >= 500
        ? 'The service is temporarily unavailable. Please try again.'
        : typeof payload?.message === 'string'
          ? payload.message
          : defaultErrorMessage(response.status)

    throw new ApiError(
      response.status,
      message,
      response.status < 500 && isValidationErrors(payload?.errors) ? payload.errors : undefined,
    )
  }

  return payload as T
}

async function ensureCsrfCookie(forceRefresh = false): Promise<void> {
  if (!forceRefresh && readCookie('XSRF-TOKEN')) {
    return
  }

  if (!csrfBootstrap) {
    csrfBootstrap = (async () => {
      const response = await fetch(`${apiBaseUrl}/csrf-cookie`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new ApiError(response.status, 'Unable to establish a secure session. Please reload and try again.')
      }

    })().finally(() => {
      csrfBootstrap = null
    })
  }

  await csrfBootstrap
}

function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method)
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)

  return value === undefined ? null : decodeURIComponent(value)
}

async function readJson(response: Response): Promise<Record<string, unknown> | undefined> {
  const text = await response.text()

  if (!text) {
    return undefined
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { message: text }
  }
}

function defaultErrorMessage(status: number) {
  if (status === 401) {
    return 'Please login again.'
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.'
  }

  if (status === 422) {
    return 'Please check the form and try again.'
  }

  if (status === 419) {
    return 'Your secure session expired. Please try again.'
  }

  if (status === 429) {
    return 'Too many attempts. Please wait and try again.'
  }

  return 'Request failed. Please try again.'
}

function isValidationErrors(value: unknown): value is ApiValidationErrors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return Object.values(value).every(
    (messages) => Array.isArray(messages) && messages.every((message) => typeof message === 'string'),
  )
}
