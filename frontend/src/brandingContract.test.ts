/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeExtensions = new Set(['.ts', '.tsx', '.css', '.html', '.svg'])
const prohibited = [
  /Matahari/i,
  /MIS logo/i,
  /mis-logo/i,
  /--brand-red/i,
  /#(?:ee2f37|d82730|b31923)/i,
]

function runtimeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)

    if (entry.isDirectory()) {
      return runtimeFiles(path)
    }

    if (
      entry.isFile() &&
      runtimeExtensions.has(extname(entry.name)) &&
      !entry.name.includes('.test.')
    ) {
      return [path]
    }

    return []
  })
}

describe('runtime branding contract', () => {
  it('does not retain legacy school branding or palette tokens', () => {
    const files = [
      ...runtimeFiles(resolve(frontendRoot, 'src')),
      resolve(frontendRoot, 'index.html'),
      resolve(frontendRoot, 'public', 'favicon.svg'),
    ]
    const sources = files.map((path) => ({
      path: relative(frontendRoot, path),
      source: readFileSync(path, 'utf8'),
    }))

    for (const { path, source } of sources) {
      for (const pattern of prohibited) {
        const match = source.match(pattern)?.[0]
        expect(match, `${path} matched prohibited token ${JSON.stringify(match)}`).toBeUndefined()
      }
    }
  })

  it('uses the semantic danger token for destructive focus', () => {
    const appStyles = readFileSync(resolve(frontendRoot, 'src', 'App.css'), 'utf8')

    expect(appStyles).toMatch(
      /\.modal-danger-action:focus-visible\s*\{\s*outline-color:\s*var\(--danger-dark\);\s*\}/,
    )
  })
})
