import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('frontend lockfile includes the optional WASM runtime required by Linux npm ci', async () => {
  const lock = JSON.parse(await readFile('frontend/package-lock.json', 'utf8'))

  assert.ok(
    lock.packages?.['node_modules/@emnapi/runtime'],
    'package-lock.json must include @emnapi/runtime for cross-platform npm ci',
  )
})
