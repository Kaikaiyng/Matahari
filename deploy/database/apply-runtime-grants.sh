#!/bin/sh
set -eu
secret_dir="${POSTGRES_SECRETS_DIR:-/run/secrets}"

[ "$#" -eq 2 ] || { echo "Usage: apply-runtime-grants.sh <database> <runtime-user>" >&2; exit 1; }
database="$1"
runtime_user="$2"
case "$database:$runtime_user" in
  matahari_staging:matahari_staging_app|matahari_production:matahari_production_app) ;;
  *) echo "Refusing an unapproved database/runtime-user pair." >&2; exit 1 ;;
esac

[ -f "$secret_dir/postgres_password" ] || { echo "Administrator secret file is missing." >&2; exit 1; }
export PGPASSWORD="$(tr -d '\r\n' < "$secret_dir/postgres_password")"
psql -X --set=ON_ERROR_STOP=1 --username=postgres --dbname="$database" <<SQL
BEGIN;
DO \$guard\$
BEGIN
  IF to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'audit_logs is required before runtime grants are applied.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$runtime_user'
    AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = '$runtime_user'::regrole)
    OR EXISTS (SELECT 1 FROM pg_class WHERE relowner = '$runtime_user'::regrole)
    OR EXISTS (SELECT 1 FROM pg_database WHERE datdba = '$runtime_user'::regrole)
    OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner = '$runtime_user'::regrole)
  THEN
    RAISE EXCEPTION 'Runtime identity must have no privileged roles, memberships, or object ownership.';
  END IF;
END
\$guard\$;
REVOKE ALL ON DATABASE "$database" FROM PUBLIC, "$runtime_user";
GRANT CONNECT ON DATABASE "$database" TO "$runtime_user";
REVOKE ALL ON SCHEMA public FROM PUBLIC, "$runtime_user";
GRANT USAGE ON SCHEMA public TO "$runtime_user";
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, "$runtime_user";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, "$runtime_user";
SELECT format('GRANT %s ON TABLE public.%I TO %I',
  CASE WHEN tablename = 'audit_logs' THEN 'SELECT, INSERT'
       WHEN tablename = 'migrations' THEN 'SELECT'
       ELSE 'SELECT, INSERT, UPDATE, DELETE' END,
  tablename, '$runtime_user')
FROM pg_tables WHERE schemaname = 'public'
\gexec
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "$runtime_user";
COMMIT;
SQL
unset PGPASSWORD
