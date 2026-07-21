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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
})
