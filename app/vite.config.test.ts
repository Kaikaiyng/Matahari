import { describe, expect, it } from 'vitest'
import { createViteConfig } from './vite.config'

describe('app development boundary', () => {
  it('uses its own port and proxies the shared API', () => {
    const config = createViteConfig({})
    expect(config.server?.port).toBe(5174)
    expect(config.server?.strictPort).toBe(true)
    expect(config.server?.allowedHosts).toContain('127.0.0.1')
    expect(config.server?.proxy).toEqual({ '/api': 'http://127.0.0.1:8000' })
  })
})
