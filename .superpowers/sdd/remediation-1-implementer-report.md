# Remediation 1 Implementer Report

## Status

IMPLEMENTED and verified for SQLite-verifiable behavior.

Real MariaDB acceptance: **INCOMPLETE**. No real MariaDB server was available, so no MariaDB-group pass is claimed. No software was installed and no production or other real database command was run.

## Safety remediation

- Replaced the post-refresh driver check with a pre-refresh gate.
- Normal runs without `AUDIT_MARIADB_DESTRUCTIVE_TEST=1` skip before the server probe and before `migrate:fresh`.
- Explicit opt-in fails closed before DDL unless:
  - `DB_URL` is exactly empty;
  - Laravel's resolved driver is exactly `mariadb`;
  - the configured database is exactly `matahari_audit_test`;
  - read-only `SELECT DATABASE()` returns exactly `matahari_audit_test`;
  - read-only `SELECT VERSION()` identifies MariaDB.
- The guarded PHPUnit test owns `migrate:fresh`; the documented unguarded refresh was removed.
- Documentation sets and clears `DB_URL=''` and the destructive-test opt-in.

## Future real-MariaDB evidence added

The guarded MariaDB group now covers:

- fresh secure audit columns and JSON round-trip;
- duplicate `event_uuid` rejection;
- all seven required named indexes;
- invalid native JSON rejection with a valid control insert;
- populated legacy-row preservation and UUID/module/context/schema backfill through the secure upgrade migration.

These cases are present but remain unexecuted against MariaDB.

## TDD evidence

1. Initial RED:
   - Command: `..\tools\php\php-local.cmd vendor\bin\phpunit tests\Unit\Audit\MariaDbDestructiveTestGateTest.php`
   - Result: 7 tests failed/errored because `Tests\Support\MariaDbDestructiveTestGate` did not exist.
2. Initial GREEN:
   - Same command.
   - Result: 7 tests passed, 13 assertions.
3. Whitespace `DB_URL` fail-closed RED:
   - Same command after adding the regression.
   - Result: 8 tests, 7 passed, 1 failed because no `RuntimeException` was thrown.
4. Whitespace `DB_URL` GREEN:
   - Same command after the minimal guard correction.
   - Result: 8 tests passed, 15 assertions.

## Final non-destructive verification

A temporary worktree autoload bootstrap was used because the repository's shared `backend/vendor` junction otherwise resolves branch classes from the parent checkout. The bootstrap was deleted after verification, and the original junction was confirmed restored.

- Guard unit:
  - `..\tools\php\php-local.cmd vendor\bin\phpunit tests\Unit\Audit\MariaDbDestructiveTestGateTest.php`
  - 8 passed, 15 assertions.
- MariaDB group under normal SQLite:
  - `..\tools\php\php-local.cmd vendor\bin\phpunit --bootstrap ..\.superpowers\sdd\phpunit-worktree-bootstrap.php --group=mariadb`
  - 5 skipped, 0 assertions; no refresh ran.
- Explicit opt-in mismatch under SQLite:
  - Set `AUDIT_MARIADB_DESTRUCTIVE_TEST=1`, then ran the same group command.
  - Expected fail-closed result: 5 errors stating `Laravel driver must be exactly mariadb; got sqlite`; no DDL ran.
- Focused audit suite under SQLite:
  - `..\tools\php\php-local.cmd vendor\bin\phpunit --bootstrap ..\.superpowers\sdd\phpunit-worktree-bootstrap.php tests\Unit\Audit tests\Feature\Audit`
  - 36 tests: 31 passed, 5 MariaDB tests skipped; 82 assertions.
- Full backend suite under SQLite:
  - With a process-local test-only `APP_KEY`, ran `..\tools\php\php-local.cmd vendor\bin\phpunit --bootstrap ..\.superpowers\sdd\phpunit-worktree-bootstrap.php`
  - 152 tests: 147 passed, 5 MariaDB tests skipped; 803 assertions.
- Changed-file Pint:
  - `..\tools\php\php-local.cmd vendor\bin\pint --test tests\Feature\Audit\AuditMariaDbSchemaTest.php tests\Support\MariaDbDestructiveTestGate.php tests\Unit\Audit\MariaDbDestructiveTestGateTest.php`
  - Passed.
- Independent review:
  - No Critical code/docs findings.
  - No Important code/docs findings after this required report was added.

## Files changed

- `backend/tests/Feature/Audit/AuditMariaDbSchemaTest.php`
- `backend/tests/Support/MariaDbDestructiveTestGate.php`
- `backend/tests/Unit/Audit/MariaDbDestructiveTestGateTest.php`
- `docs/DEVELOPMENT_SETUP.md`
- `.superpowers/sdd/remediation-1-implementer-report.md`

## Remaining concern

The real MariaDB acceptance run is still required on a disposable server/database that satisfies the gate. A skipped SQLite run is not acceptance evidence.
