import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api'

describe('apiRequest', () => {
  afterEach(() => vi.restoreAllMocks())

  it('hides internal details returned by a server error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'SQLSTATE[HY000]: General error: could not find driver in C:\\server\\Connection.php:829',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(apiRequest('/me')).rejects.toMatchObject({
      status: 500,
      message: 'The service is temporarily unavailable. Please try again.',
    })
  })

  it('preserves an actionable validation message', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Please check the form.', errors: { email: ['Email is required.'] } }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    await expect(apiRequest('/students', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 422,
      message: 'Please check the form.',
      errors: { email: ['Email is required.'] },
    })
  })

  it('bootstraps the CSRF cookie before a mutation and sends its decoded value', async () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: '',
    })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => {
        document.cookie = 'XSRF-TOKEN=before%20mutation'

        return new Response(null, { status: 204 })
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await apiRequest('/students', { method: 'POST', body: { name: 'Student' } })

    expect(fetchSpy).toHaveBeenNthCalledWith(1, '/api/csrf-cookie', expect.objectContaining({ credentials: 'include' }))
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/students',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({}),
      }),
    )
    const request = fetchSpy.mock.calls[1][1] as RequestInit
    expect(new Headers(request.headers).get('X-XSRF-TOKEN')).toBe('before mutation')
  })

  it('does not bootstrap CSRF for a safe GET request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )

    await apiRequest('/me')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/api/me', expect.objectContaining({ credentials: 'include' }))
  })
})
