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
const activeDemoSourcePaths = [
  'backend/database/seeders/DatabaseSeeder.php',
  'backend/database/seeders/DemoScenarioSeeder.php',
  'backend/app/Services/Billing/ReceiptGenerationService.php',
  'docs/DEMO_REVIEW_SCRIPT.md',
  'frontend/README.md',
]
const prohibitedContentTokens = [
  /Matahari/i,
  /MIS logo/i,
  /mis-logo/i,
  /\bMIS\b/i,
  /--brand-red/i,
  /#(?:ee2f37|d82730|b31923)/i,
]
const prohibitedPathTokens = [/Matahari/i, /mis-logo/i, /\bMIS\b/i]
const approvedRootPalette = {
  '--brand-primary': '#2563eb',
  '--brand-primary-dark': '#1d4ed8',
  '--brand-primary-soft': '#eff6ff',
  '--danger': '#b42318',
  '--danger-dark': '#7a271a',
  '--danger-soft': '#fef3f2',
  '--sidebar': '#ffffff',
  '--canvas': '#f4f7fb',
  '--surface': '#ffffff',
  '--text': '#172033',
  '--muted': '#64748b',
  '--border': '#dfe5ee',
  '--border-strong': '#cbd5e1',
} as const
const approvedSchoolSeed = {
  name: 'Demo International School',
  receipt_prefix: 'DEMO',
  invoice_prefix: 'DEMO-INV',
  email: 'admin@demo-school.test',
  phone: '+60 3-0000 0000',
  address: 'Fictional demo school, Malaysia',
  status: 'active',
} as const
const semanticSelectorPattern =
  /danger|error|invalid|warning|warn|outstanding|unpaid|delete|void|field-error|form-field|overdue|failed|destructive|critical|alert/i

type ContractSource = {
  path: string
  source?: string
}

type TextContractSource = ContractSource & {
  source: string
}

type CssBlock = {
  selector: string
  declarations: string
}

type CssViolation = {
  selector: string
  token: string
}

type RgbColor = readonly [number, number, number]

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

function frontendRepositoryPath(path: string): string {
  return `frontend/${relative(frontendRoot, path).replaceAll('\\', '/')}`
}

function readContractSource(path: string): TextContractSource {
  return {
    path,
    source: readFileSync(resolve(repositoryRoot, path), 'utf8'),
  }
}

function runtimeContractSources(): ContractSource[] {
  return frontendRuntimeFiles().map((file) => ({
    path: frontendRepositoryPath(file),
    source: runtimeTextExtensions.has(extname(file)) ? readFileSync(file, 'utf8') : undefined,
  }))
}

function isTextCssSource(source: ContractSource): source is TextContractSource {
  return source.path.endsWith('.css') && source.source !== undefined
}

function negativeScanSources(): ContractSource[] {
  return [...runtimeContractSources(), ...activeDemoSourcePaths.map(readContractSource)]
}

function expectNoMatch(path: string, token: string | undefined): void {
  expect(token, `${path}: prohibited token ${JSON.stringify(token)}`).toBeUndefined()
}

function expectNoProhibitedContent(sources: ContractSource[]): void {
  for (const { path, source } of sources) {
    for (const pattern of prohibitedPathTokens) {
      expectNoMatch(path, path.match(pattern)?.[0])
    }

    if (source === undefined) {
      continue
    }

    for (const pattern of prohibitedContentTokens) {
      expectNoMatch(path, source.match(pattern)?.[0])
    }
  }
}

function expectSourcePattern({ path, source }: TextContractSource, label: string, pattern: RegExp): void {
  expect(pattern.test(source), `${path}: expected ${label}`).toBe(true)
}

function expectOccurrenceCount(source: TextContractSource, label: string, pattern: RegExp, expected: number): void {
  expect([...source.source.matchAll(pattern)].length, `${source.path}: ${label} occurrence count`).toBe(expected)
}

function phpStringFieldValues(source: string, field: string): string[] {
  return [...source.matchAll(new RegExp(`'${field}'\\s*(?:=>|,)\\s*'([^']+)'`, 'g'))].map((match) => match[1])
}

function expectExactValues(path: string, label: string, actual: string[], expected: readonly string[]): void {
  expect([...actual].sort(), `${path}: ${label}`).toEqual([...expected].sort())
}

function expectExclusiveSchoolSeed(databaseSeeder: TextContractSource): void {
  expectOccurrenceCount(databaseSeeder, 'School::updateOrCreate', /School::query\(\)->updateOrCreate\(/g, 1)

  const records = [
    ...databaseSeeder.source.matchAll(
      /School::query\(\)->updateOrCreate\(\s*\[\s*'code'\s*=>\s*'([^']+)'\s*,?\s*\],\s*\[([\s\S]*?)\n\s*\],\s*\);/g,
    ),
  ]

  expect(records.length, `${databaseSeeder.path}: school seed record count`).toBe(1)

  const record = records[0]
  expect(record?.[1], `${databaseSeeder.path}: school code`).toBe('DEMO')

  const fields = [...(record?.[2] ?? '').matchAll(/'([a-z_]+)'\s*=>\s*'([^']+)'/g)]
  expectExactValues(
    databaseSeeder.path,
    'school seed field names',
    fields.map((field) => field[1]),
    Object.keys(approvedSchoolSeed),
  )

  for (const [field, value] of Object.entries(approvedSchoolSeed)) {
    const matches = fields.filter((candidate) => candidate[1] === field)

    expect(matches.length, `${databaseSeeder.path}: ${field} occurrence count`).toBe(1)
    expect(matches[0]?.[2], `${databaseSeeder.path}: ${field}`).toBe(value)
  }
}

function cssBlocks(source: string): CssBlock[] {
  const commentFreeSource = source.replace(/\/\*[\s\S]*?\*\//g, '')

  return [...commentFreeSource.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    declarations: match[2],
  }))
}

function rootPaletteContractViolations(source: string): string[] {
  const rootBlocks = cssBlocks(source).filter(({ selector }) => compactSelector(selector) === ':root')

  if (rootBlocks.length !== 1) {
    return [`expected exactly one :root block, found ${rootBlocks.length}`]
  }

  const palette = Object.fromEntries(
    [...rootBlocks[0].declarations.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, token, value]) => [
      token,
      value,
    ]),
  )
  const violations: string[] = []
  const actualTokens = Object.keys(palette).sort()
  const expectedTokens = Object.keys(approvedRootPalette).sort()

  if (JSON.stringify(actualTokens) !== JSON.stringify(expectedTokens)) {
    violations.push(`root palette tokens: ${actualTokens.join(', ')}`)
  }

  for (const [token, value] of Object.entries(approvedRootPalette)) {
    if (palette[token] !== value) {
      violations.push(`${token}: ${String(palette[token])}`)
    }
  }

  return violations
}

function hexToRgb(literal: string): RgbColor {
  const hex = literal.slice(1)
  const normalized = hex.length <= 4 ? hex.slice(0, 3).split('').map((part) => part.repeat(2)).join('') : hex.slice(0, 6)

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

function rgbComponent(component: string): number {
  const value = Number.parseFloat(component)

  return component.endsWith('%') ? (value / 100) * 255 : value
}

function isSaturatedRed([red, green, blue]: RgbColor): boolean {
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum

  if (maximum === 0 || delta === 0 || delta / maximum < 0.45) {
    return false
  }

  let hue: number

  if (maximum === red) {
    hue = 60 * (((green - blue) / delta) % 6)
  } else if (maximum === green) {
    hue = 60 * ((blue - red) / delta + 2)
  } else {
    hue = 60 * ((red - green) / delta + 4)
  }

  const normalizedHue = (hue + 360) % 360

  return normalizedHue <= 20 || normalizedHue >= 340
}

function redColorLiterals(declarations: string): string[] {
  const hexLiterals = [...declarations.matchAll(/#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})\b/gi)]
    .map((match) => match[0])
    .filter((literal) => isSaturatedRed(hexToRgb(literal)))
  const rgbLiterals = [
    ...declarations.matchAll(
      /rgba?\(\s*([\d.]+%?)\s*(?:,|\s)\s*([\d.]+%?)\s*(?:,|\s)\s*([\d.]+%?)(?:\s*(?:,|\/)\s*[\d.]+%?)?\s*\)/gi,
    ),
  ]
    .filter((match) => isSaturatedRed([rgbComponent(match[1]), rgbComponent(match[2]), rgbComponent(match[3])]))
    .map((match) => match[0])

  return [...hexLiterals, ...rgbLiterals]
}

function compactSelector(selector: string): string {
  return selector.replace(/\s+/g, ' ').trim()
}

function semanticColorViolations(source: string): CssViolation[] {
  return cssBlocks(source).flatMap(({ selector, declarations }) => {
    const normalizedSelector = compactSelector(selector)
    const effectiveSelectors = normalizedSelector.split(',').map(compactSelector).filter(Boolean)
    const declarationsToInspect =
      effectiveSelectors.length === 1 && effectiveSelectors[0] === ':root'
        ? declarations.replace(/^\s*--[\w-]+\s*:\s*[^;]+;\s*$/gm, '')
        : declarations

    if (effectiveSelectors.length > 0 && effectiveSelectors.every((candidate) => semanticSelectorPattern.test(candidate))) {
      return []
    }

    const dangerTokens = [...declarationsToInspect.matchAll(/var\(--danger(?:-[\w-]+)?\)/g)].map((match) => match[0])

    return [...dangerTokens, ...redColorLiterals(declarationsToInspect)].map((token) => ({
      selector: normalizedSelector,
      token,
    }))
  })
}

function expectNoSemanticColorViolations(source: TextContractSource): void {
  for (const violation of semanticColorViolations(source.source)) {
    expect(violation, `${source.path}: ${violation.selector}: ${violation.token}`).toBeUndefined()
  }
}

describe('runtime branding contract', () => {
  it('keeps runtime and active demo sources free of legacy branding', () => {
    expectNoProhibitedContent(negativeScanSources())
  })

  it('uses the exact approved root palette', () => {
    const path = 'frontend/src/index.css'
    const source = readFileSync(resolve(repositoryRoot, path), 'utf8')

    expect(rootPaletteContractViolations(source), path).toEqual([])
  })

  it('uses danger tokens and saturated red literals only in semantic CSS selectors', () => {
    for (const source of runtimeContractSources().filter(isTextCssSource)) {
      expectNoSemanticColorViolations(source)
    }
  })

  it('classifies saturated red without treating green or amber as danger colors', () => {
    expect(isSaturatedRed(hexToRgb('#b42318'))).toBe(true)
    expect(isSaturatedRed([180, 35, 24])).toBe(true)
    expect(isSaturatedRed(hexToRgb('#167a4a'))).toBe(false)
    expect(isSaturatedRed(hexToRgb('#9b6500'))).toBe(false)
    expect(isSaturatedRed(hexToRgb('#2563eb'))).toBe(false)
  })

  it('detects raw red outside a semantic CSS selector', () => {
    expect(semanticColorViolations('.primary-action { color: #b42318; }')).toEqual([
      { selector: '.primary-action', token: '#b42318' },
    ])
  })

  it('rejects a non-semantic selector mixed with a semantic selector', () => {
    expect(semanticColorViolations('.danger-action, .primary-action { color: #b42318; }')).toEqual([
      { selector: '.danger-action, .primary-action', token: '#b42318' },
    ])
  })

  it('does not let CSS comments make a neutral selector semantic', () => {
    expect(semanticColorViolations('.primary-action /* danger */ { color: #b42318; }')).toEqual([
      { selector: '.primary-action', token: '#b42318' },
    ])
  })

  it('rejects a second root block that introduces an unapproved red token', () => {
    const firstRoot = `:root {\n${Object.entries(approvedRootPalette)
      .map(([token, value]) => `  ${token}: ${value};`)
      .join('\n')}\n}`
    const source = `${firstRoot}\n:root { --brand-accent: #ff0000; }\n.primary-action { color: var(--brand-accent); }`

    expect(rootPaletteContractViolations(source)).toEqual(['expected exactly one :root block, found 2'])
  })

  it('keeps the backend demo seed and receipt fallback identity approved', () => {
    const databaseSeeder = readContractSource('backend/database/seeders/DatabaseSeeder.php')
    const demoScenarioSeeder = readContractSource('backend/database/seeders/DemoScenarioSeeder.php')
    const receiptGenerationService = readContractSource('backend/app/Services/Billing/ReceiptGenerationService.php')

    expectExclusiveSchoolSeed(databaseSeeder)
    expectOccurrenceCount(databaseSeeder, 'DEMO school code', /\['code'\s*=>\s*'DEMO'\]/g, 1)
    expectOccurrenceCount(databaseSeeder, 'Demo International School', /Demo International School/g, 1)

    for (const name of ['Demo Super Admin', 'Demo School Admin', 'Demo Finance Admin']) {
      expectOccurrenceCount(databaseSeeder, name, new RegExp(name, 'g'), 1)
    }

    expectExactValues(
      databaseSeeder.path,
      'seeded student identifiers',
      phpStringFieldValues(databaseSeeder.source, 'student_no'),
      ['DEMO-2026-001', 'DEMO-2026-002', 'DEMO-2026-003'],
    )
    expectSourcePattern(demoScenarioSeeder, 'school lookup DEMO', /where\('code',\s*'DEMO'\)/)
    expectOccurrenceCount(
      demoScenarioSeeder,
      'school code lookup',
      /School::query\(\)->where\('code',\s*'[^']+'\)/g,
      1,
    )
    expectExactValues(
      demoScenarioSeeder.path,
      'scenario student identifiers',
      phpStringFieldValues(demoScenarioSeeder.source, 'student_no'),
      ['DEMO-2026-001', 'DEMO-2026-002', 'DEMO-2026-003', 'DEMO-2026-004'],
    )
    expectOccurrenceCount(
      receiptGenerationService,
      'last-resort receipt fallback DEMO',
      /\$prefix\s*=\s*\$payment->school\?->receipt_prefix\s*\?:\s*\$payment->school\?->code\s*\?:\s*'DEMO';/g,
      1,
    )
  })

  it('uses the semantic danger token for destructive focus', () => {
    const appStyles = readFileSync(resolve(frontendRoot, 'src', 'App.css'), 'utf8')

    expect(appStyles).toMatch(
      /\.modal-danger-action:focus-visible\s*\{\s*outline-color:\s*var\(--danger-dark\);\s*\}/,
    )
  })
})
