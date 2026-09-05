import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const backupPath = 'deploy/scripts/backup-postgres.sh'
const verifyPath = 'deploy/scripts/verify-postgres-restore.sh'
const shell = findShell()

function findShell() {
  const candidates = process.platform === 'win32'
    ? ['C:\\Program Files\\Git\\bin\\sh.exe', 'C:\\Program Files\\Git\\usr\\bin\\sh.exe']
    : ['sh']

  return candidates.find((candidate) =>
    (process.platform !== 'win32' || existsSync(candidate)) && spawnSync(candidate, ['-c', ':']).status === 0,
  ) ?? null
}

function runScript(path, arguments_, extraEnvironment = {}) {
  const environment = { ...process.env }
  delete environment.PGPASSWORD
  Object.assign(environment, extraEnvironment)

  return spawnSync(shell, [path, ...arguments_], { encoding: 'utf8', env: environment })
}

test('PostgreSQL backup requires explicit safe inputs and emits only a custom-format archive', async () => {
  const script = await readFile(backupPath, 'utf8')

  assert.match(script, /^#!\/bin\/sh\nset -eu/m)
  assert.match(script, /--database/)
  assert.match(script, /--output-directory/)
  assert.match(script, /Refusing plaintext password input/)
  assert.match(script, /PGPASSWORD/)
  assert.match(script, /pg_dump/)
  assert.match(script, /--format=custom/)
  assert.match(script, /--no-password/)
  assert.match(script, /--file="\$temporary_archive"/)
  assert.doesNotMatch(script, /pg_dumpall|--format=(?:plain|directory|tar)|--clean/)
})

test('PostgreSQL backup requires a real output directory and cannot overwrite an archive', async () => {
  const script = await readFile(backupPath, 'utf8')

  assert.match(script, /\[ -d "\$output_directory" \]/)
  assert.match(script, /\[ ! -L "\$output_directory" \]/)
  assert.match(script, /\[ ! -e "\$archive" \]/)
  assert.match(script, /ln "\$temporary_archive" "\$archive"/)
  assert.match(script, /sha256sum/)
  assert.match(script, /umask 077/)
  assert.doesNotMatch(script, /(?:mv|cp)\s+(?:-[^\s]*f[^\s]*\s+)?"\$temporary_archive"\s+"\$archive"/)
})

test('restore verification requires opt-in and a new allowlisted disposable database', async () => {
  const script = await readFile(verifyPath, 'utf8')

  assert.match(script, /MATAHARI_POSTGRES_RESTORE_VERIFY/)
  assert.match(script, /matahari_restore_verify_/)
  assert.match(script, /matahari\|matahari_production\|matahari_staging/)
  assert.match(script, /SELECT count\(\*\) FROM pg_database/)
  assert.match(script, /createdb/)
  assert.match(script, /Refusing plaintext password input/)
  assert.match(script, /PGPASSWORD/)
  assert.ok(script.indexOf('SELECT count(*) FROM pg_database') < script.indexOf('\ncreatedb '))
})

test('restore verification checks the archive and uses fail-fast ownership-neutral restore flags', async () => {
  const script = await readFile(verifyPath, 'utf8')

  assert.match(script, /sha256sum --check --status/)
  assert.match(script, /checksum sidecar must contain exactly one record/)
  assert.match(script, /checksum sidecar does not name the selected archive/)
  assert.match(script, /archive_magic/)
  assert.match(script, /5047444d50/)
  assert.match(script, /pg_restore --list/)
  assert.match(script, /pg_restore/)
  assert.match(script, /--exit-on-error/)
  assert.match(script, /--no-owner/)
  assert.match(script, /--no-privileges/)
  assert.match(script, /--no-password/)
  assert.doesNotMatch(script, /--clean|--create/)
})

test('restore verification checks critical counts and sequence position without deleting the database', async () => {
  const script = await readFile(verifyPath, 'utf8')

  for (const table of [
    'payments', 'payment_allocations', 'receipts', 'receipt_sequences',
    'fee_agreements', 'fee_agreement_items', 'fee_record_charges', 'audit_logs',
  ]) {
    assert.match(script, new RegExp(`public\\.${table}`))
  }
  assert.match(script, /relkind = 'S'/)
  assert.match(script, /FROM pg_tables WHERE schemaname = 'public'/)
  assert.match(script, /last_value/)
  assert.match(script, /is_called/)
  assert.match(script, /max\(%I\)/)
  assert.match(script, /Verification database retained/)
  assert.match(script, /Cleanup command/)
  assert.match(script, /dropdb --if-exists/)
  assert.doesNotMatch(script, /^\s*dropdb\b/m)
  assert.doesNotMatch(script, /DROP DATABASE/i)
})

test('argument guards fail before any PostgreSQL command can run', { skip: shell === null }, () => {
  const missingOutput = runScript(backupPath, ['--database', 'matahari_production'])
  assert.notEqual(missingOutput.status, 0)
  assert.match(missingOutput.stderr, /Output directory is required/)

  const passwordArgument = runScript(backupPath, [
    '--database', 'matahari_production', '--output-directory', '.', '--password=redacted',
  ])
  assert.notEqual(passwordArgument.status, 0)
  assert.match(passwordArgument.stderr, /Refusing plaintext password input/)

  const passwordEnvironment = runScript(
    backupPath,
    ['--database', 'matahari_production', '--output-directory', '.'],
    { PGPASSWORD: 'redacted' },
  )
  assert.notEqual(passwordEnvironment.status, 0)
  assert.match(passwordEnvironment.stderr, /Refusing plaintext password input through PGPASSWORD/)

  for (const database of ['matahari', 'matahari_staging', 'matahari_production']) {
    const protectedRestore = runScript(verifyPath, [
      '--archive', 'missing.dump', '--database', database,
    ], { MATAHARI_POSTGRES_RESTORE_VERIFY: '1' })
    assert.notEqual(protectedRestore.status, 0)
    assert.match(protectedRestore.stderr, /protected Matahari database/)
  }

  const unapprovedRestore = runScript(verifyPath, [
    '--archive', 'missing.dump', '--database', 'temporary_restore',
  ], { MATAHARI_POSTGRES_RESTORE_VERIFY: '1' })
  assert.notEqual(unapprovedRestore.status, 0)
  assert.match(unapprovedRestore.stderr, /matahari_restore_verify_<name>/)

  const noOptIn = runScript(verifyPath, [])
  assert.notEqual(noOptIn.status, 0)
  assert.match(noOptIn.stderr, /MATAHARI_POSTGRES_RESTORE_VERIFY=1/)
})

test('PostgreSQL recovery scripts have valid POSIX shell syntax', { skip: shell === null }, () => {
  for (const path of [backupPath, verifyPath]) {
    const result = spawnSync(shell, ['-n', path], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
})
