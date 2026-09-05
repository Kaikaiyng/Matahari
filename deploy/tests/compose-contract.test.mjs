import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

async function listFiles(root, current = root) {
  const files = []
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.name === '.build' || entry.name === 'artifacts') continue
    const path = join(current, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)))
    else files.push(path.slice(root.length + 1).replaceAll('\\', '/'))
  }
  return files
}

test('database Compose keeps PostgreSQL private with a separate data volume', async () => {
  const compose = await readFile('deploy/compose/database.yml', 'utf8')

  assert.match(compose, /image: postgres:18\.6-bookworm/)
  assert.doesNotMatch(compose, /^\s+ports:/m)
  assert.match(compose, /postgres_data:\/var\/lib\/postgresql/)
  assert.match(compose, /name: matahari_postgres_data/)
  assert.match(compose, /scram-sha-256/)
  assert.doesNotMatch(compose, /mariadb_data|\/var\/lib\/mysql/)
  assert.match(compose, /name: rylay_database/)
})

test('application Compose binds only to loopback and hardens release mounts', async () => {
  const compose = await readFile('deploy/compose/application.yml', 'utf8')

  assert.match(compose, /127\.0\.0\.1:\$\{APP_HTTP_PORT\}:8080/)
  assert.match(compose, /127\.0\.0\.1:\$\{MOBILE_APP_HTTP_PORT\}:8080/)
  assert.match(compose, /mobile-app\.conf/)
  assert.match(compose, /\$\{RELEASE_ROOT\}\/current:\/var\/www\/rylay\/current:ro/)
  assert.match(compose, /read_only: true/)
  assert.match(compose, /no-new-privileges:true/)
  assert.match(compose, /\/health/)
  assert.match(compose, /external: true/)
  assert.match(compose, /storage-init:/)
  assert.match(compose, /bootstrap_cache:\/var\/www\/rylay\/current\/backend\/bootstrap\/cache/)
})

test('environment examples preserve staging and production boundaries without values that resemble secrets', async () => {
  const database = await readFile('deploy/env/database.env.example', 'utf8')
  const staging = await readFile('deploy/env/staging.env.example', 'utf8')
  const production = await readFile('deploy/env/production.env.example', 'utf8')

  assert.match(database, /STAGING_DB_DATABASE=matahari_staging/)
  assert.match(database, /PRODUCTION_DB_DATABASE=matahari_production/)
  assert.match(staging, /COMPOSE_PROJECT_NAME=rylay_staging/)
  assert.match(staging, /DEPLOYMENT_MODE=staging/)
  assert.match(staging, /TENANCY_MODE=dedicated/)
  assert.match(staging, /TENANCY_DEDICATED_TENANT_SLUG=mis/)
  assert.match(staging, /MOBILE_APP_HTTP_PORT=18082/)
  assert.match(staging, /DB_USERNAME=matahari_staging_app/)
  assert.match(production, /COMPOSE_PROJECT_NAME=rylay_production/)
  assert.match(production, /DEPLOYMENT_MODE=prelaunch-production/)
  assert.match(production, /TENANCY_MODE=dedicated/)
  assert.match(production, /TENANCY_DEDICATED_TENANT_SLUG=mis/)
  assert.match(production, /COMMUNITY_DEVELOPER_NAME=Matahari/)
  assert.match(production, /COMMUNITY_ACCOUNT_DELETION_URL=https:\/\//)
  assert.match(production, /MOBILE_APP_HTTP_PORT=18083/)
  assert.match(production, /DB_USERNAME=matahari_production_app/)

  for (const contents of [database, staging, production]) {
    assert.doesNotMatch(contents, /(?:PASSWORD|SECRET|TOKEN|APP_KEY)=\S+/)
  }
})

test('deployment source contains no tracked-style secret artifacts', async () => {
  const files = await listFiles('deploy')
  const forbidden = files.filter((path) =>
    /(^|\/)(?:\.env|htpasswd|id_rsa|id_ed25519)$|\.(?:sqlite|sqlite3|pem|key)$/i.test(path),
  )

  assert.deepEqual(forbidden, [])
})

test('database scripts restrict environment pairs and audit grants', async () => {
  const init = await readFile('deploy/database/init-databases.sh', 'utf8')
  const grants = await readFile('deploy/database/apply-runtime-grants.sh', 'utf8')

  assert.match(init, /matahari_staging_app/)
  assert.match(init, /matahari_production_app/)
  assert.match(init, /matahari_staging_migrator/)
  assert.match(init, /matahari_production_migrator/)
  assert.match(grants, /audit_logs/)
  assert.match(grants, /SELECT, INSERT/)
  assert.doesNotMatch(grants, /migrate:fresh|DROP DATABASE/)
})
