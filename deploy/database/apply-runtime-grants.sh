#!/bin/sh
set -eu

[ "$#" -eq 2 ] || { echo "Usage: apply-runtime-grants.sh <database> <runtime-user>" >&2; exit 1; }
database="$1"
runtime_user="$2"

case "$database:$runtime_user" in
  rylay_staging:rylay_staging_app|rylay_production:rylay_production_app) ;;
  *) echo "Refusing an unapproved database/runtime-user pair." >&2; exit 1 ;;
esac

[ -f /run/secrets/mariadb_root_password ] || { echo "Root secret file is missing." >&2; exit 1; }
export MYSQL_PWD="$(tr -d '\r\n' < /run/secrets/mariadb_root_password)"

tables="$(mariadb --protocol=socket -uroot --batch --skip-column-names -e \
  "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$database' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME")"

printf '%s\n' "$tables" | grep -qx 'audit_logs' || { echo "audit_logs is required before runtime grants are applied." >&2; exit 1; }

mariadb --protocol=socket -uroot -e "REVOKE ALL PRIVILEGES, GRANT OPTION FROM '$runtime_user'@'%';"

printf '%s\n' "$tables" | while IFS= read -r table; do
  case "$table" in
    ''|*[!A-Za-z0-9_]*) echo "Unsafe table name detected." >&2; exit 1 ;;
  esac

  if [ "$table" = audit_logs ]; then
    privileges='SELECT, INSERT'
  else
    privileges='SELECT, INSERT, UPDATE, DELETE'
  fi

  mariadb --protocol=socket -uroot -e \
    "GRANT $privileges ON \`$database\`.\`$table\` TO '$runtime_user'@'%';"
done

mariadb --protocol=socket -uroot -e 'FLUSH PRIVILEGES;'
unset MYSQL_PWD
