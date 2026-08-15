import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { createRelease } from '../scripts/create-release.mjs'

const commit = '0123456789abcdef0123456789abcdef01234567'
const buildTime = '2026-08-06T00:00:00.000Z'

async function writeFixture(root, relativePath, content = 'fixture\n') {
  const target = join(root, relativePath)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'rylay-release-'))
  const files = [
    'backend/app/Example.php',
    'backend/bootstrap/app.php',
    'backend/config/app.php',
    'backend/public/index.php',
    'backend/resources/views/app.php',
    'backend/routes/web.php',
    'backend/storage/app/.gitignore',
    'backend/storage/framework/.gitignore',
    'backend/storage/logs/.gitignore',
    'backend/artisan',
    'backend/vendor/autoload.php',
    'frontend/dist/index.html',
    'app/dist/index.html',
  ]

  await Promise.all(files.map((file) => writeFixture(root, file)))
  await writeFixture(root, 'backend/database/migrations/2026_01_01_000001_example.php')
  await writeFixture(root, 'backend/composer.json', '{"require":{"php":"^8.3"}}\n')
  await writeFixture(
    root,
    'backend/composer.lock',
    JSON.stringify({ packages: [{ name: 'laravel/framework', version: 'v13.17.0' }] }),
  )
  await writeFixture(root, 'frontend/package-lock.json', '{"lockfileVersion":3}\n')
  await writeFixture(root, 'app/package-lock.json', '{"lockfileVersion":3}\n')
  await writeFixture(root, 'backend/.env', 'DB_PASSWORD=secret\n')
  await writeFixture(root, 'backend/database/database.sqlite', 'private database')

  return root
}

test('creates a stable manifest from only deployable files', async (context) => {
  const source = await createFixture()
  context.after(() => rm(source, { recursive: true, force: true }))
  const output = join(source, 'output')

  const manifest = await createRelease({
    source,
    output,
    commit,
    buildTime,
    infrastructureVersion: '1',
    phpVersion: '8.4.21',
    nodeVersion: '24.12.0',
  })

  assert.equal(manifest.schema_version, 1)
  assert.equal(manifest.git_commit, commit)
  assert.equal(manifest.build_time_utc, buildTime)
  assert.equal(manifest.infrastructure_version, '1')
  assert.deepEqual(manifest.runtime, {
    php: '8.4.21',
    node: '24.12.0',
    laravel: '13.17.0',
  })
  assert.deepEqual(manifest.migrations, ['2026_01_01_000001_example.php'])
  assert.ok(manifest.files.some((file) => file.path === 'backend/app/Example.php'))
  assert.ok(manifest.files.some((file) => file.path === 'frontend/dist/index.html'))
  assert.ok(manifest.files.some((file) => file.path === 'app/dist/index.html'))
  assert.ok(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)))
  await assert.rejects(readFile(join(output, 'backend', '.env')), /ENOENT/)
  await assert.rejects(readFile(join(output, 'backend', 'database', 'database.sqlite')), /ENOENT/)

  const written = JSON.parse(await readFile(join(output, 'release-manifest.json'), 'utf8'))
  assert.deepEqual(written, manifest)
})

test('writes byte-identical manifests for identical inputs', async (context) => {
  const source = await createFixture()
  context.after(() => rm(source, { recursive: true, force: true }))
  const options = {
    source,
    commit,
    buildTime,
    infrastructureVersion: '1',
    phpVersion: '8.4.21',
    nodeVersion: '24.12.0',
  }

  await createRelease({ ...options, output: join(source, 'output-a') })
  await createRelease({ ...options, output: join(source, 'output-b') })

  assert.equal(
    await readFile(join(source, 'output-a', 'release-manifest.json'), 'utf8'),
    await readFile(join(source, 'output-b', 'release-manifest.json'), 'utf8'),
  )
})

test('rejects unsafe or incomplete release inputs', async (context) => {
  const source = await createFixture()
  context.after(() => rm(source, { recursive: true, force: true }))
  const base = {
    source,
    buildTime,
    infrastructureVersion: '1',
    phpVersion: '8.4.21',
    nodeVersion: '24.12.0',
  }

  await assert.rejects(
    createRelease({ ...base, output: join(source, 'bad-commit'), commit: 'short' }),
    /40-character lowercase Git commit/,
  )

  const nonEmpty = join(source, 'non-empty')
  await writeFixture(nonEmpty, 'existing.txt')
  await assert.rejects(createRelease({ ...base, output: nonEmpty, commit }), /output directory must be empty/)

  await rm(join(source, 'backend', 'vendor'), { recursive: true, force: true })
  await assert.rejects(
    createRelease({ ...base, output: join(source, 'missing-vendor'), commit }),
    /required release path is missing: backend\/vendor/,
  )
})
