#!/bin/sh
set -eu

require_identifier() {
  name="$1"
  value="$2"
  case "$value" in
    ''|*[!A-Za-z0-9_]*) echo "Invalid database identifier: $name" >&2; exit 1 ;;
  esac
}

read_secret() {
  secret_file="$1"
  [ -f "$secret_file" ] || { echo "Required secret file is missing." >&2; exit 1; }
  secret_value="$(tr -d '\r\n' < "$secret_file")"
  case "$secret_value" in
    *[!A-Za-z0-9_-]*|'') echo "Secret must be generated base64url text." >&2; exit 1 ;;
  esac
  [ "${#secret_value}" -ge 32 ] || { echo "Secret must contain at least 32 characters." >&2; exit 1; }
  printf '%s' "$secret_value"
}

: "${STAGING_DB_DATABASE:=rylay_staging}"
: "${STAGING_DB_USERNAME:=rylay_staging_app}"
: "${STAGING_MIGRATOR_USERNAME:=rylay_staging_migrator}"
: "${PRODUCTION_DB_DATABASE:=rylay_production}"
: "${PRODUCTION_DB_USERNAME:=rylay_production_app}"
: "${PRODUCTION_MIGRATOR_USERNAME:=rylay_production_migrator}"

require_identifier STAGING_DB_DATABASE "$STAGING_DB_DATABASE"
require_identifier STAGING_DB_USERNAME "$STAGING_DB_USERNAME"
require_identifier STAGING_MIGRATOR_USERNAME "$STAGING_MIGRATOR_USERNAME"
require_identifier PRODUCTION_DB_DATABASE "$PRODUCTION_DB_DATABASE"
require_identifier PRODUCTION_DB_USERNAME "$PRODUCTION_DB_USERNAME"
require_identifier PRODUCTION_MIGRATOR_USERNAME "$PRODUCTION_MIGRATOR_USERNAME"

[ "$STAGING_DB_DATABASE:$STAGING_DB_USERNAME:$STAGING_MIGRATOR_USERNAME" = "rylay_staging:rylay_staging_app:rylay_staging_migrator" ] || exit 1
[ "$PRODUCTION_DB_DATABASE:$PRODUCTION_DB_USERNAME:$PRODUCTION_MIGRATOR_USERNAME" = "rylay_production:rylay_production_app:rylay_production_migrator" ] || exit 1

staging_app_password="$(read_secret /run/secrets/staging_app_password)"
staging_migrator_password="$(read_secret /run/secrets/staging_migrator_password)"
production_app_password="$(read_secret /run/secrets/production_app_password)"
production_migrator_password="$(read_secret /run/secrets/production_migrator_password)"
export MYSQL_PWD="$(read_secret /run/secrets/mariadb_root_password)"

mariadb --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`$STAGING_DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS \`$PRODUCTION_DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$STAGING_DB_USERNAME'@'%' IDENTIFIED BY '$staging_app_password';
CREATE USER IF NOT EXISTS '$STAGING_MIGRATOR_USERNAME'@'%' IDENTIFIED BY '$staging_migrator_password';
CREATE USER IF NOT EXISTS '$PRODUCTION_DB_USERNAME'@'%' IDENTIFIED BY '$production_app_password';
CREATE USER IF NOT EXISTS '$PRODUCTION_MIGRATOR_USERNAME'@'%' IDENTIFIED BY '$production_migrator_password';
GRANT USAGE ON *.* TO '$STAGING_DB_USERNAME'@'%';
GRANT ALL PRIVILEGES ON \`$STAGING_DB_DATABASE\`.* TO '$STAGING_MIGRATOR_USERNAME'@'%';
GRANT USAGE ON *.* TO '$PRODUCTION_DB_USERNAME'@'%';
GRANT ALL PRIVILEGES ON \`$PRODUCTION_DB_DATABASE\`.* TO '$PRODUCTION_MIGRATOR_USERNAME'@'%';
FLUSH PRIVILEGES;
SQL

unset MYSQL_PWD staging_app_password staging_migrator_password production_app_password production_migrator_password
