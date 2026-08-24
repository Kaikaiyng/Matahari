import { beforeEach, describe, expect, it, vi } from 'vitest'
import { portalApi } from './portalApi'

describe('School Updates API contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.cookie = 'XSRF-TOKEN=test-token'
  })

  it('serializes the exact post report payload', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { id: 8, status: 'submitted' } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }))

    await portalApi.reportSchoolUpdate(37, 'outdated', 'The event date has passed.')

    expect(fetch).toHaveBeenCalledOnce()
    const [path, request] = fetch.mock.calls[0]
    expect(path).toBe('/api/v1/community/reports')
    expect(JSON.parse(String(request?.body))).toEqual({
      target_type: 'post',
      target_id: 37,
      reason_code: 'outdated',
      details: 'The event date has passed.',
    })
  })
})
