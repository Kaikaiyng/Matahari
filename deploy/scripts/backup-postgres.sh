#!/bin/sh
set -eu

usage() {
  echo 'Usage: backup-postgres.sh --database <name> --output-directory <existing-directory> [--host <host>] [--port <port>] [--username <user>]' >&2
}

fail() {
  echo "$1" >&2
  exit 1
}

require_value() {
  [ "$#" -ge 2 ] && [ -n "$2" ] || { usage; fail "Missing value for $1."; }
}

database=''
output_directory=''
host="${PGHOST:-127.0.0.1}"
port="${PGPORT:-5432}"
username="${PGUSER:-postgres}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --database)
      require_value "$@"
      database="$2"
      shift 2
      ;;
    --output-directory)
      require_value "$@"
      output_directory="$2"
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

[ -z "${PGPASSWORD:-}" ] || fail 'Refusing plaintext password input through PGPASSWORD; use PGPASSFILE or another PostgreSQL credential provider.'
[ -n "$database" ] || { usage; fail 'Database is required.'; }
[ -n "$output_directory" ] || { usage; fail 'Output directory is required.'; }
[ "${#database}" -le 63 ] && printf '%s' "$database" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$' || fail 'Database must be a PostgreSQL identifier of at most 63 characters.'
[ "${#username}" -le 63 ] && printf '%s' "$username" | grep -Eq '^[A-Za-z_][A-Za-z0-9_]*$' || fail 'Username must be a PostgreSQL identifier of at most 63 characters.'
printf '%s' "$host" | grep -Eq '^[A-Za-z0-9._:-]+$' || fail 'Host contains unsupported characters.'
printf '%s' "$port" | grep -Eq '^[0-9]+$' || fail 'Port must be numeric.'
[ "$port" -ge 1 ] && [ "$port" -le 65535 ] || fail 'Port must be between 1 and 65535.'

[ -d "$output_directory" ] || fail 'Output directory must already exist.'
[ ! -L "$output_directory" ] || fail 'Output directory must not be a symbolic link.'
[ -w "$output_directory" ] || fail 'Output directory is not writable.'
output_directory="$(cd "$output_directory" && pwd -P)"

command -v pg_dump >/dev/null 2>&1 || fail 'pg_dump is required.'
command -v sha256sum >/dev/null 2>&1 || fail 'sha256sum is required.'
command -v mktemp >/dev/null 2>&1 || fail 'mktemp is required.'

timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
archive="$output_directory/$database-$timestamp.dump"
checksum="$archive.sha256"
[ ! -e "$archive" ] || fail 'Refusing to overwrite an existing backup archive.'
[ ! -e "$checksum" ] || fail 'Refusing to overwrite an existing backup checksum.'

umask 077
temporary_archive="$(mktemp "$output_directory/.matahari-postgres-backup.XXXXXX")"
temporary_checksum="$(mktemp "$output_directory/.matahari-postgres-checksum.XXXXXX")"
published_archive=0
published_checksum=0
completed=0

cleanup() {
  [ -z "${temporary_archive:-}" ] || rm -f -- "$temporary_archive"
  [ -z "${temporary_checksum:-}" ] || rm -f -- "$temporary_checksum"
  if [ "$completed" -ne 1 ] && [ "$published_archive" -eq 1 ]; then
    rm -f -- "$archive"
  fi
  if [ "$completed" -ne 1 ] && [ "$published_checksum" -eq 1 ]; then
    rm -f -- "$checksum"
  fi
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

pg_dump \
  --format=custom \
  --no-password \
  --host="$host" \
  --port="$port" \
  --username="$username" \
  --file="$temporary_archive" \
  --dbname="$database"

[ -s "$temporary_archive" ] || fail 'pg_dump produced an empty archive.'
chmod 600 "$temporary_archive"
checksum_output="$(sha256sum "$temporary_archive")" || fail 'Unable to calculate the backup checksum.'
archive_hash="${checksum_output%% *}"
printf '%s' "$archive_hash" | grep -Eq '^[a-f0-9]{64}$' || fail 'Backup checksum output was invalid.'
printf '%s  %s\n' "$archive_hash" "$(basename "$archive")" > "$temporary_checksum"
chmod 600 "$temporary_checksum"

# Hard-link publication fails when the destination exists, so even a production
# backup can never replace an archive or checksum created by an earlier run.
ln "$temporary_archive" "$archive" || fail 'Refusing to overwrite an existing backup archive.'
published_archive=1
ln "$temporary_checksum" "$checksum" || fail 'Refusing to overwrite an existing backup checksum.'
published_checksum=1
rm -f -- "$temporary_archive" "$temporary_checksum"
temporary_archive=''
temporary_checksum=''
completed=1

echo "PostgreSQL custom-format backup created: $archive"
echo "Checksum created: $checksum"
