#!/bin/sh
set -eu

usage() {
  echo 'Usage: verify-postgres-restore.sh --archive <backup.dump> --database <matahari_restore_verify_name> [--host <host>] [--port <port>] [--username <user>]' >&2
}

fail() {
  echo "$1" >&2
  exit 1
}

require_value() {
  [ "$#" -ge 2 ] && [ -n "$2" ] || { usage; fail "Missing value for $1."; }
}

archive=''
verify_database=''
host="${PGHOST:-127.0.0.1}"
port="${PGPORT:-5432}"
username="${PGUSER:-postgres}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --archive)
      require_value "$@"
      archive="$2"
      shift 2
      ;;
    --database)
      require_value "$@"
      verify_database="$2"
      shift 2
      ;;
    --host)
      require_value "$@"
      host="$2"
      shift 2
      ;;
    --port)
      require_value "$@"
      port="$2"
      shift 2
      ;;
    --username)
      require_value "$@"
      username="$2"
      shift 2
      ;;
    --password|--password=*|-W)
      fail 'Refusing plaintext password input; use PGPASSFILE or another PostgreSQL credential provider.'
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage
      fail "Unknown argument: $1"
      ;;
  esac
done

[ "${MATAHARI_POSTGRES_RESTORE_VERIFY:-}" = 1 ] || fail 'Set MATAHARI_POSTGRES_RESTORE_VERIFY=1 to create a disposable restore-verification database.'
[ -z "${PGPASSWORD:-}" ] || fail 'Refusing plaintext password input through PGPASSWORD; use PGPASSFILE or another PostgreSQL credential provider.'
[ -n "$archive" ] || { usage; fail 'Archive is required.'; }
[ -n "$verify_database" ] || { usage; fail 'Verification database is required.'; }
case "$verify_database" in
  matahari|matahari_production|matahari_staging)
    fail 'Refusing to restore into a protected Matahari database.'
    ;;
esac
[ "${#verify_database}" -le 63 ] && printf '%s' "$verify_database" | grep -Eq '^matahari_restore_verify_[a-z0-9][a-z0-9_]*$' || fail 'Verification database must use the matahari_restore_verify_<name> allowlisted pattern.'
[ "${#username}" -le 63 ] && printf '%s' "$username" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$' || fail 'Username must be a PostgreSQL identifier of at most 63 characters.'
printf '%s' "$host" | grep -Eq '^[A-Za-z0-9._:-]+$' || fail 'Host contains unsupported characters.'
printf '%s' "$port" | grep -Eq '^[0-9]+$' || fail 'Port must be numeric.'
[ "$port" -ge 1 ] && [ "$port" -le 65535 ] || fail 'Port must be between 1 and 65535.'

[ -f "$archive" ] || fail 'Backup archive does not exist or is not a regular file.'
[ ! -L "$archive" ] || fail 'Backup archive must not be a symbolic link.'
archive_directory="$(cd "$(dirname "$archive")" && pwd -P)"
archive="$archive_directory/$(basename "$archive")"
printf '%s' "$(basename "$archive")" | grep -Eq '^[A-Za-z0-9._-]+\.dump$' || fail 'Archive filename must use safe characters and the .dump extension.'
checksum="$archive.sha256"
[ -f "$checksum" ] && [ ! -L "$checksum" ] || fail 'A regular, non-symbolic-link .sha256 sidecar is required.'

for command_name in sha256sum pg_restore psql createdb od; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required."
done

checksum_lines="$(wc -l < "$checksum" | tr -d ' ')"
[ "$checksum_lines" = 1 ] || fail 'Backup checksum sidecar must contain exactly one record.'
checksum_name="$(awk '{print $2}' "$checksum")"
[ "$checksum_name" = "$(basename "$archive")" ] || fail 'Backup checksum sidecar does not name the selected archive.'
(cd "$archive_directory" && sha256sum --check --status "$(basename "$checksum")") || fail 'Backup checksum verification failed.'
archive_magic="$(od -An -tx1 -N5 "$archive" | tr -d ' \r\n')"
[ "$archive_magic" = 5047444d50 ] || fail 'Archive is not in PostgreSQL custom format.'
pg_restore --list "$archive" >/dev/null || fail 'Archive is not a readable PostgreSQL custom-format backup.'

database_exists="$(psql --no-password --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --host="$host" --port="$port" --username="$username" --dbname=postgres \
  --command="SELECT count(*) FROM pg_database WHERE datname = '$verify_database';")"
[ "$database_exists" = 0 ] || fail 'Verification database already exists; choose a new disposable database name.'

created=0
print_retention_notice() {
  if [ "$created" -eq 1 ]; then
    echo "Verification database retained: $verify_database"
    echo 'Cleanup command (run only after reviewing the verification result):'
    printf '  dropdb --if-exists --no-password --host=%s --port=%s --username=%s %s\n' "$host" "$port" "$username" "$verify_database"
  fi
}
trap print_retention_notice EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

createdb --no-password --host="$host" --port="$port" --username="$username" --maintenance-db=postgres \
  --template=template0 --encoding=UTF8 "$verify_database"
created=1

pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --no-password \
  --host="$host" \
  --port="$port" \
  --username="$username" \
  --dbname="$verify_database" \
  "$archive"

psql --no-password --no-psqlrc --set=ON_ERROR_STOP=1 \
  --host="$host" --port="$port" --username="$username" --dbname="$verify_database" <<'SQL'
DO $table_guard$
BEGIN
  IF to_regclass('public.students') IS NULL
    OR to_regclass('public.receipt_items') IS NULL
    OR to_regclass('public.payments') IS NULL
    OR to_regclass('public.payment_allocations') IS NULL
    OR to_regclass('public.receipts') IS NULL
    OR to_regclass('public.receipt_sequences') IS NULL
    OR to_regclass('public.fee_agreements') IS NULL
    OR to_regclass('public.fee_agreement_items') IS NULL
    OR to_regclass('public.fee_record_charges') IS NULL
    OR to_regclass('public.audit_logs') IS NULL
  THEN
    RAISE EXCEPTION 'A required finance or audit table is missing from the restored database.';
  END IF;
END
$table_guard$;

SELECT 'all_public_tables' AS record_set, count(*)::bigint AS restored_rows FROM pg_tables WHERE schemaname = 'public'
UNION ALL SELECT 'payments', count(*)::bigint FROM public.payments
UNION ALL SELECT 'students', count(*)::bigint FROM public.students
UNION ALL SELECT 'receipt_items', count(*)::bigint FROM public.receipt_items
UNION ALL SELECT 'payment_allocations', count(*)::bigint FROM public.payment_allocations
UNION ALL SELECT 'receipts', count(*)::bigint FROM public.receipts
UNION ALL SELECT 'receipt_sequences', count(*)::bigint FROM public.receipt_sequences
UNION ALL SELECT 'fee_agreements', count(*)::bigint FROM public.fee_agreements
UNION ALL SELECT 'fee_agreement_items', count(*)::bigint FROM public.fee_agreement_items
UNION ALL SELECT 'fee_record_charges', count(*)::bigint FROM public.fee_record_charges
UNION ALL SELECT 'audit_logs', count(*)::bigint FROM public.audit_logs
ORDER BY record_set;

DO $sequence_guard$
DECLARE
  sequence_record record;
  table_max numeric;
  last_value numeric;
  is_called boolean;
  checked_sequences integer := 0;
BEGIN
  FOR sequence_record IN
    SELECT sequence_namespace.nspname AS sequence_schema,
           sequence_relation.relname AS sequence_name,
           table_namespace.nspname AS table_schema,
           table_relation.relname AS table_name,
           table_column.attname AS column_name
      FROM pg_class AS sequence_relation
      JOIN pg_namespace AS sequence_namespace ON sequence_namespace.oid = sequence_relation.relnamespace
      JOIN pg_depend AS dependency
        ON dependency.classid = 'pg_class'::regclass
       AND dependency.objid = sequence_relation.oid
       AND dependency.refclassid = 'pg_class'::regclass
       AND dependency.deptype IN ('a', 'i')
      JOIN pg_class AS table_relation ON table_relation.oid = dependency.refobjid
      JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_relation.relnamespace
      JOIN pg_attribute AS table_column
        ON table_column.attrelid = table_relation.oid
       AND table_column.attnum = dependency.refobjsubid
     WHERE sequence_relation.relkind = 'S'
       AND sequence_namespace.nspname = 'public'
  LOOP
    checked_sequences := checked_sequences + 1;
    EXECUTE format('SELECT max(%I)::numeric FROM %I.%I', sequence_record.column_name, sequence_record.table_schema, sequence_record.table_name)
      INTO table_max;
    EXECUTE format('SELECT last_value::numeric, is_called FROM %I.%I', sequence_record.sequence_schema, sequence_record.sequence_name)
      INTO last_value, is_called;

    IF table_max IS NOT NULL AND (last_value < table_max OR (last_value = table_max AND NOT is_called)) THEN
      RAISE EXCEPTION 'Sequence %.% is behind %.% (last %, max %, called %).',
        sequence_record.sequence_schema, sequence_record.sequence_name,
        sequence_record.table_schema, sequence_record.table_name,
        last_value, table_max, is_called;
    END IF;
  END LOOP;

  IF checked_sequences = 0 THEN
    RAISE EXCEPTION 'No owned public sequences were found in the restored database.';
  END IF;
END
$sequence_guard$;
SQL

echo "PostgreSQL restore verification passed: $verify_database"
