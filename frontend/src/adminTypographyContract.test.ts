/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(resolve(sourceRoot, 'App.tsx'), 'utf8')
const typographyPath = resolve(sourceRoot, 'AdminTypography.css')

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
      '--admin-type-page-title': '28px',
      '--admin-type-section-title': '20px',
      '--admin-type-card-title': '16px',
      '--admin-type-body': '14px',
      '--admin-type-label': '13px',
      '--admin-type-supporting': '12px',
      '--admin-type-eyebrow': '11px',
      '--admin-type-metric-min': '24px',
      '--admin-type-metric-max': '30px',
    }

    for (const [token, value] of Object.entries(expectedTokens)) {
      expect(typography, `${token} must remain ${value}`).toMatch(
        new RegExp(`${token}:\\s*${value.replace('.', '\\.')}`),
      )
    }
  })
})
