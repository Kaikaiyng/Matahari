import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const platformFiles = [
  '.github/workflows/full-qualification.yml',
  '.github/workflows/release-candidate.yml',
  'frontend/package.json',
  'frontend/package-lock.json',
  'app/package.json',
  'app/package-lock.json',
  'deploy/compose/application.yml',
  'deploy/compose/database.yml',
  'deploy/database/apply-runtime-grants.sh',
  'deploy/database/init-databases.sh',
  'deploy/docker/nginx/app.conf',
  'deploy/docker/nginx/mobile-app.conf',
  'deploy/docker/php/Dockerfile',
  'deploy/docker/php/entrypoint.sh',
  'deploy/env/database.env.example',
  'deploy/env/production.env.example',
  'deploy/env/staging.env.example',
  'deploy/scripts/package-release.sh',
]

test('active platform identifiers use the RYLAY name', async () => {
  for (const path of platformFiles) {
    const contents = await readFile(path, 'utf8')
    assert.doesNotMatch(contents, /matahari/i, `${path} still contains a historical platform identifier`)
  }

  assert.equal(JSON.parse(await readFile('frontend/package.json', 'utf8')).name, 'rylay-admin')
  assert.equal(JSON.parse(await readFile('app/package.json', 'utf8')).name, 'rylay-community-app')
  assert.match(await readFile('deploy/scripts/package-release.sh', 'utf8'), /rylay-\$commit\.zip/)
})
