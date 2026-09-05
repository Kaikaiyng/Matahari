import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('master workflow checks, builds once, and retains the immutable artifact', async () => {
  const workflow = await readFile('.github/workflows/release-candidate.yml', 'utf8')

  assert.match(workflow, /branches: \[master\]/)
  assert.match(workflow, /permissions:\s+contents: read/)
  assert.match(workflow, /npm ci/)
  assert.match(workflow, /composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader/)
  assert.match(workflow, /create-release\.mjs/)
  assert.match(workflow, /package-release\.sh/)
  assert.match(workflow, /actions\/upload-artifact@v7/)
  assert.match(workflow, /retention-days: 30/)
  assert.match(workflow, /uses: \.\/\.github\/workflows\/full-qualification\.yml/)
})

test('full qualification includes Laravel, frontend, advisory, deployment, and PostgreSQL checks', async () => {
  const workflow = await readFile('.github/workflows/full-qualification.yml', 'utf8')

  assert.match(workflow, /image: postgres:18\.6-bookworm/)
  assert.match(workflow, /DB_CONNECTION: pgsql/)
  assert.match(workflow, /MATAHARI_PGSQL_TEST_ALLOW_RESET: '1'/)
  assert.match(workflow, /php artisan test/)
  assert.match(workflow, /php artisan migrate --force/)
  assert.match(workflow, /php artisan migrate:rollback --force/)
  assert.match(workflow, /npm run lint/)
  assert.match(workflow, /npm run build/)
  assert.match(workflow, /composer audit --locked/)
  assert.match(workflow, /npm audit --omit=dev --audit-level=moderate/)
  assert.match(workflow, /node --test deploy\/tests\/\*\.test\.mjs/)
})

test('foundation workflows do not request deployment secrets or write repository contents', async () => {
  const release = await readFile('.github/workflows/release-candidate.yml', 'utf8')
  const qualification = await readFile('.github/workflows/full-qualification.yml', 'utf8')
  const combined = `${release}\n${qualification}`

  assert.doesNotMatch(combined, /secrets\.[A-Z_]+/)
  assert.doesNotMatch(combined, /contents: write|pull-requests: write/)
  assert.doesNotMatch(combined, /^\s+(?:ssh|scp|rsync)\s/im)
})
