import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

function versionAtLeast(actual, minimum) {
  const actualParts = actual.replace(/^v/, '').split('.').map(Number)
  const minimumParts = minimum.split('.').map(Number)

  for (let index = 0; index < 3; index += 1) {
    if (actualParts[index] > minimumParts[index]) return true
    if (actualParts[index] < minimumParts[index]) return false
  }
  return true
}

test('Composer lock excludes the known vulnerable Guzzle range', async () => {
  const lock = JSON.parse(await readFile('backend/composer.lock', 'utf8'))
  const guzzle = [...(lock.packages ?? []), ...(lock['packages-dev'] ?? [])]
    .find((dependency) => dependency.name === 'guzzlehttp/guzzle')

  assert.ok(guzzle, 'guzzlehttp/guzzle must be present in composer.lock')
  assert.ok(
    versionAtLeast(guzzle.version, '7.15.1'),
    `guzzlehttp/guzzle ${guzzle.version} is below the audited minimum 7.15.1`,
  )
})

test('Composer lock excludes the known vulnerable CommonMark range', async () => {
  const lock = JSON.parse(await readFile('backend/composer.lock', 'utf8'))
  const commonmark = [...(lock.packages ?? []), ...(lock['packages-dev'] ?? [])]
    .find((dependency) => dependency.name === 'league/commonmark')

  assert.ok(commonmark, 'league/commonmark must be present in composer.lock')
  assert.ok(
    versionAtLeast(commonmark.version, '2.9.0'),
    `league/commonmark ${commonmark.version} is below the audited minimum 2.9.0`,
  )
})
