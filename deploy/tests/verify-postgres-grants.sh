#!/bin/sh
set -eu
# Run only on a new, disposable CI cluster; init refuses existing deployment databases.
[ "${APP_ENV:-}" = testing ] && [ "${DB_DATABASE:-}" = matahari_test ] && [ "${MATAHARI_PGSQL_TEST_ALLOW_RESET:-}" = 1 ] || exit 1
: "${POSTGRES_SECRETS_DIR:?Set an empty private secret directory outside the repository}"
: "${DB_PASSWORD:?Set the disposable postgres administrator password}"
[ ! -e "$POSTGRES_SECRETS_DIR/postgres_password" ] || { echo 'Refusing to overwrite an existing secret directory.' >&2; exit 1; }
mkdir -p "$POSTGRES_SECRETS_DIR"
umask 077
printf '%s' "$DB_PASSWORD" > "$POSTGRES_SECRETS_DIR/postgres_password"
for label in staging production; do
  openssl rand -hex 32 > "$POSTGRES_SECRETS_DIR/${label}_app_password"
  openssl rand -hex 32 > "$POSTGRES_SECRETS_DIR/${label}_migrator_password"
done
export PGHOST="${DB_HOST:-127.0.0.1}" PGPORT="${DB_PORT:-5432}"
sh deploy/database/init-databases.sh
for label in staging production; do
  database="matahari_$label"
  migrator="${database}_migrator"
  runtime_user="${database}_app"
  (cd backend && DB_DATABASE="$database" DB_USERNAME="$migrator" DB_PASSWORD="$(cat "$POSTGRES_SECRETS_DIR/${label}_migrator_password")" php artisan migrate --force)
  sh deploy/database/apply-runtime-grants.sh "$database" "$runtime_user"
  PGPASSWORD="$DB_PASSWORD" psql -X -U postgres -d "$database" -v runtime_user="$runtime_user" -f deploy/tests/postgres-grants.sql
  # Real runtime login works, but the other deployment database remains inaccessible.
  runtime_password="$(cat "$POSTGRES_SECRETS_DIR/${label}_app_password")"
  PGPASSWORD="$runtime_password" psql -X -U "$runtime_user" -d "$database" -c 'SELECT 1' > /dev/null
  other=matahari_staging
  [ "$label" = staging ] && other=matahari_production
  if PGPASSWORD="$runtime_password" psql -X -U "$runtime_user" -d "$other" -c 'SELECT 1' > /dev/null 2>&1; then
    echo 'Cross-environment database access was unexpectedly permitted.' >&2
    exit 1
  fi
done
echo 'PostgreSQL initialization, migrations, audit privileges and deployment isolation passed.'
