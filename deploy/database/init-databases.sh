#!/bin/sh
set -eu
secret_dir="${POSTGRES_SECRETS_DIR:-/run/secrets}"

read_secret() {
  [ -f "$1" ] || { echo "Required secret file is missing." >&2; exit 1; }
  secret_value="$(tr -d '\r\n' < "$1")"
  case "$secret_value" in
    *[!A-Za-z0-9_-]*|'') echo "Secret must be generated base64url text." >&2; exit 1 ;;
  esac
  [ "${#secret_value}" -ge 32 ] || { echo "Secret must contain at least 32 characters." >&2; exit 1; }
  printf '%s' "$secret_value"
}

: "${STAGING_DB_DATABASE:=matahari_staging}"
: "${STAGING_DB_USERNAME:=matahari_staging_app}"
: "${STAGING_MIGRATOR_USERNAME:=matahari_staging_migrator}"
: "${PRODUCTION_DB_DATABASE:=matahari_production}"
: "${PRODUCTION_DB_USERNAME:=matahari_production_app}"
: "${PRODUCTION_MIGRATOR_USERNAME:=matahari_production_migrator}"

[ "$STAGING_DB_DATABASE:$STAGING_DB_USERNAME:$STAGING_MIGRATOR_USERNAME" = 'matahari_staging:matahari_staging_app:matahari_staging_migrator' ] || exit 1
[ "$PRODUCTION_DB_DATABASE:$PRODUCTION_DB_USERNAME:$PRODUCTION_MIGRATOR_USERNAME" = 'matahari_production:matahari_production_app:matahari_production_migrator' ] || exit 1
export PGPASSWORD="$(read_secret "$secret_dir/postgres_password")"

create_environment() {
  database="$1"
  runtime_user="$2"
  migrator="$3"
  label="$4"
  runtime_password="$(read_secret "$secret_dir/${label}_app_password")"
  migrator_password="$(read_secret "$secret_dir/${label}_migrator_password")"

  # Identifiers are fixed above; passwords are validated base64url, sent only on stdin.
  # First-start only: existing roles/databases intentionally fail instead of being overwritten.
  psql -X --set=ON_ERROR_STOP=1 --username=postgres --dbname=postgres <<SQL
CREATE ROLE "$runtime_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '$runtime_password';
CREATE ROLE "$migrator" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '$migrator_password';
CREATE DATABASE "$database" OWNER "$migrator" ENCODING 'UTF8' TEMPLATE template0;
REVOKE ALL ON DATABASE "$database" FROM PUBLIC;
GRANT CONNECT ON DATABASE "$database" TO "$runtime_user";
SQL
  psql -X --set=ON_ERROR_STOP=1 --username=postgres --dbname="$database" <<SQL
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO "$migrator";
GRANT USAGE ON SCHEMA public TO "$runtime_user";
SQL
  unset runtime_password migrator_password
}

create_environment "$STAGING_DB_DATABASE" "$STAGING_DB_USERNAME" "$STAGING_MIGRATOR_USERNAME" staging
create_environment "$PRODUCTION_DB_DATABASE" "$PRODUCTION_DB_USERNAME" "$PRODUCTION_MIGRATOR_USERNAME" production
unset PGPASSWORD
