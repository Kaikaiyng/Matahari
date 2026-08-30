/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(resolve(sourceRoot, 'App.tsx'), 'utf8')
const typographyPath = resolve(sourceRoot, 'AdminTypography.css')
const shellSource = readFileSync(resolve(sourceRoot, 'components/AdminShell.css'), 'utf8')
const indexSource = readFileSync(resolve(sourceRoot, 'index.css'), 'utf8')
const adminUiSource = readFileSync(resolve(sourceRoot, 'components/AdminUi.css'), 'utf8')

describe('Admin typography contract', () => {
  it('loads the Admin typography layer after the legacy application styles', () => {
    expect(appSource.indexOf("import './AdminTypography.css'"))
      .toBeGreaterThan(appSource.indexOf("import './App.css'"))
  })

  it('defines the approved semantic scale', () => {
    expect(existsSync(typographyPath), 'AdminTypography.css must exist').toBe(true)

    if (!existsSync(typographyPath)) return

    const typography = readFileSync(typographyPath, 'utf8')
    const expectedTokens = {
      '--admin-type-page-title': '24px',
      '--admin-type-section-title': '18px',
      '--admin-type-card-title': '15px',
      '--admin-type-body': '14px',
      '--admin-type-label': '13px',
      '--admin-type-supporting': '12px',
      '--admin-type-eyebrow': '11px',
      '--admin-type-metric-min': '24px',
      '--admin-type-metric-max': '24px',
    }

    for (const [token, value] of Object.entries(expectedTokens)) {
      expect(typography, `${token} must remain ${value}`).toMatch(
        new RegExp(`${token}:\\s*${value.replace('.', '\\.')}`),
      )
    }
  })

  it('matches the MAW shell density', () => {
    expect(shellSource).toMatch(/\.admin-brand\s*{[^}]*min-height:\s*80px/s)
    expect(shellSource).toMatch(/\.admin-brand\s*{[^}]*flex:\s*0 0 80px/s)
    expect(shellSource).toMatch(/\.admin-workspace\s*{[^}]*grid-template-rows:\s*56px/s)
    expect(shellSource).toMatch(/\.utility-header\s*{[^}]*height:\s*56px/s)
    expect(shellSource).toMatch(/\.utility-header\s*{[^}]*padding:\s*0 32px/s)
    expect(shellSource).toMatch(/\.admin-main\s*{[^}]*max-width:\s*1600px/s)
    expect(shellSource).toMatch(/\.admin-main\s*{[^}]*margin-inline:\s*auto/s)
    expect(shellSource).toMatch(/\.admin-main\s*{[^}]*padding:\s*24px 32px/s)
  })

  it('defines the owner-approved MAW surface and motion contract', () => {
    const expectedTokens = [
      '--admin-primary', '--admin-primary-hover', '--admin-focus-ring', '--admin-surface',
      '--admin-inset', '--admin-border', '--admin-shadow', '--admin-shadow-hover',
      '--admin-radius', '--admin-gap', '--admin-motion-fast', '--admin-motion-standard',
      '--admin-motion-expand',
    ]
    expectedTokens.forEach((token) => expect(indexSource).toContain(token))
    expect(indexSource).toMatch(/--admin-gap:\s*16px/)
    expect(indexSource).toMatch(/--admin-motion-fast:\s*140ms/)
    expect(indexSource).toMatch(/--admin-motion-standard:\s*200ms/)
    expect(indexSource).toMatch(/--admin-motion-expand:\s*260ms/)
    expect(adminUiSource).toMatch(/@keyframes admin-popover-enter/)
    expect(adminUiSource).toMatch(/240ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/)
    expect(adminUiSource).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })
})
