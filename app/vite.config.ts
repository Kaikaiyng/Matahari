import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

export function createViteConfig(env: Record<string, string | undefined> = process.env): ViteUserConfig {
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000'
  const apiProxy = { target: apiProxyTarget, changeOrigin: false }

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      allowedHosts: ['127.0.0.1'],
      proxy: { '/api': apiProxy },
    },
    preview: {
      host: '127.0.0.1',
      port: 4176,
      strictPort: true,
      allowedHosts: ['127.0.0.1'],
      proxy: { '/api': apiProxy },
    },
  }
}

export default defineConfig(({ mode }) => createViteConfig(loadEnv(mode || 'development', process.cwd(), '')))
