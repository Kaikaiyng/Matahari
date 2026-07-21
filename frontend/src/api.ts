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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

type RequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  body?: unknown
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, ...requestOptions } = options
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

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
