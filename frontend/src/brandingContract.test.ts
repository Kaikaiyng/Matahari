/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(frontendRoot, '..')
const runtimeTextExtensions = new Set([
  '.css',
  '.cjs',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.webmanifest',
])
const testPathSegments = new Set(['test', 'tests', '__tests__', '__mocks__', '__fixtures__'])
const prohibitedContentTokens = [
  /Matahari/i,
  /MIS logo/i,
  /mis-logo/i,
  /\bMIS\b/i,
  /--brand-red/i,
  /#(?:ee2f37|d82730|b31923)/i,
]
const prohibitedFileNameTokens = [/Matahari/i, /mis-logo/i, /\bMIS\b/i]
const approvedRootPalette = {
  '--brand-primary': '#2563eb',
  '--brand-primary-dark': '#1d4ed8',
  '--brand-primary-soft': '#eff6ff',
  '--danger': '#b42318',
  '--danger-dark': '#7a271a',
  '--danger-soft': '#fef3f2',
  '--sidebar': '#172033',
  '--canvas': '#f4f7fb',
  '--surface': '#ffffff',
  '--text': '#172033',
  '--muted': '#64748b',
  '--border': '#dfe5ee',
  '--border-strong': '#cbd5e1',
} as const

type ContractSource = {
  path: string
  source: string
}

function filesRecursively(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      return filesRecursively(path)
    }

    return entry.isFile() ? [path] : []
  })
}

function isTestFile(path: string): boolean {
  const segments = relative(frontendRoot, path).split(/[\\/]/)

  return (
    segments.some((segment) => testPathSegments.has(segment)) || /\.(?:test|spec)\.[^.]+$/i.test(basename(path))
  )
}

function frontendRuntimeFiles(): string[] {
  return [
    ...filesRecursively(resolve(frontendRoot, 'src')).filter((path) => !isTestFile(path)),
    resolve(frontendRoot, 'index.html'),
    ...filesRecursively(resolve(frontendRoot, 'public')).filter((path) => !isTestFile(path)),
  ].sort()
}

function expectNoMatch(path: string, token: string | undefined): void {
  expect(token, `${path}: prohibited token ${JSON.stringify(token)}`).toBeUndefined()
}

function expectSourcePattern({ path, source }: ContractSource, label: string, pattern: RegExp): void {
  expect(pattern.test(source), `${path}: expected ${label}`).toBe(true)
}

function readContractSource(path: string): ContractSource {
  return {
    path,
    source: readFileSync(resolve(repositoryRoot, path), 'utf8'),
  }
}

describe('runtime branding contract', () => {
  it('keeps runtime frontend source and public asset names free of legacy branding', () => {
    for (const file of frontendRuntimeFiles()) {
      const path = relative(frontendRoot, file)

      for (const pattern of prohibitedFileNameTokens) {
        expectNoMatch(path, path.match(pattern)?.[0])
      }

      if (!runtimeTextExtensions.has(extname(file))) {
        continue
      }

      const source = readFileSync(file, 'utf8')

      for (const pattern of prohibitedContentTokens) {
        expectNoMatch(path, source.match(pattern)?.[0])
      }
    }
  })

  it('uses the exact approved root palette', () => {
    const path = 'frontend/src/index.css'
    const source = readFileSync(resolve(repositoryRoot, path), 'utf8')
    const rootBlock = source.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1]

    expect(rootBlock, `${path}: missing :root block`).toBeDefined()

    const palette = Object.fromEntries(
      [...(rootBlock ?? '').matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, token, value]) => [token, value]),
    )

    expect(Object.keys(palette).sort(), `${path}: root palette tokens`).toEqual(
      Object.keys(approvedRootPalette).sort(),
    )

    for (const [token, value] of Object.entries(approvedRootPalette)) {
      expect(palette[token], `${path}: ${token}`).toBe(value)
    }
  })

  it('keeps the backend demo seed and receipt fallback identity approved', () => {
    const databaseSeeder = readContractSource('backend/database/seeders/DatabaseSeeder.php')
    const demoScenarioSeeder = readContractSource('backend/database/seeders/DemoScenarioSeeder.php')
    const receiptGenerationService = readContractSource('backend/app/Services/Billing/ReceiptGenerationService.php')

    expectSourcePattern(databaseSeeder, 'school code DEMO', /\['code'\s*=>\s*'DEMO'\]/)
    expectSourcePattern(databaseSeeder, 'Demo International School', /'name'\s*=>\s*'Demo International School'/)
    expectSourcePattern(databaseSeeder, 'receipt prefix DEMO', /'receipt_prefix'\s*=>\s*'DEMO'/)
    expectSourcePattern(databaseSeeder, 'invoice prefix DEMO-INV', /'invoice_prefix'\s*=>\s*'DEMO-INV'/)

    for (const name of ['Demo Super Admin', 'Demo School Admin', 'Demo Finance Admin']) {
      expectSourcePattern(databaseSeeder, name, new RegExp(`'name'\\s*=>\\s*'${name}'`))
    }

    for (const studentNo of ['DEMO-2026-001', 'DEMO-2026-002', 'DEMO-2026-003']) {
      expectSourcePattern(databaseSeeder, studentNo, new RegExp(`'student_no'\\s*=>\\s*'${studentNo}'`))
    }

    expectSourcePattern(demoScenarioSeeder, 'school lookup DEMO', /where\('code',\s*'DEMO'\)/)

    for (const studentNo of ['DEMO-2026-001', 'DEMO-2026-002', 'DEMO-2026-003', 'DEMO-2026-004']) {
      expectSourcePattern(demoScenarioSeeder, studentNo, new RegExp(`'${studentNo}'`))
    }

    expectSourcePattern(
      receiptGenerationService,
      'last-resort receipt fallback DEMO',
      /\$prefix\s*=\s*\$payment->school\?->receipt_prefix\s*\?:\s*\$payment->school\?->code\s*\?:\s*'DEMO';/,
    )
  })

  it('uses the semantic danger token for destructive focus', () => {
    const appStyles = readFileSync(resolve(frontendRoot, 'src', 'App.css'), 'utf8')

    expect(appStyles).toMatch(
      /\.modal-danger-action:focus-visible\s*\{\s*outline-color:\s*var\(--danger-dark\);\s*\}/,
    )
  })
})
