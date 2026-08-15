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
      allowedHosts: ['localhost', '.trycloudflare.com'],
      proxy: {
        '/api': { target: 'http://127.0.0.1:8002', changeOrigin: false },
      },
    })
    expect(config.server?.proxy).toEqual({
      '/api': { target: 'http://127.0.0.1:8002', changeOrigin: false },
    })
    expect(config.server?.allowedHosts).toEqual(['localhost', '.trycloudflare.com'])
  })

  it('keeps the normal local API target when no override is supplied', () => {
    const config = createViteConfig({})

    expect(config.server?.proxy).toEqual({
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    })
    expect(config.server?.allowedHosts).toEqual(['localhost', '.trycloudflare.com'])
  })
})
