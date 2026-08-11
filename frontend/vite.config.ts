import react from '@vitejs/plugin-react'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

export function createViteConfig(env: NodeJS.ProcessEnv = process.env): ViteUserConfig {
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
    server: {
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        '/api': apiProxyTarget,
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4175,
      strictPort: true,
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        '/api': apiProxyTarget,
      },
    },
  }
}

export default defineConfig(createViteConfig())
