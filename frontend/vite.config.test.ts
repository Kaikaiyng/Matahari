import { describe, expect, it } from 'vitest'
import { createViteConfig } from './vite.config'

describe('public demo preview config', () => {
  it('binds loopback and proxies the API to the supplied backend', () => {
    const config = createViteConfig({
      VITE_API_PROXY_TARGET: 'http://127.0.0.1:8002',
    })

    expect(config.preview).toEqual({
      host: '127.0.0.1',
      port: 4175,
      strictPort: true,
      allowedHosts: ['.trycloudflare.com'],
      proxy: { '/api': 'http://127.0.0.1:8002' },
    })
    expect(config.server?.proxy).toEqual({
      '/api': 'http://127.0.0.1:8002',
    })
    expect(config.server?.allowedHosts).toEqual(['.trycloudflare.com'])
  })

  it('keeps the normal local API target when no override is supplied', () => {
    const config = createViteConfig({})

    expect(config.server?.proxy).toEqual({
      '/api': 'http://127.0.0.1:8000',
    })
    expect(config.server?.allowedHosts).toEqual(['.trycloudflare.com'])
  })
})
