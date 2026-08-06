#!/bin/sh
set -eu

storage_path="${MATAHARI_STORAGE_PATH:-/var/www/matahari/current/backend/storage}"

mkdir -p \
  "$storage_path/app/private" \
  "$storage_path/framework/cache/data" \
  "$storage_path/framework/sessions" \
  "$storage_path/framework/views" \
  "$storage_path/logs"

exec "$@"
