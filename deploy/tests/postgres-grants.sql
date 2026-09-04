\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE :"runtime_user";
INSERT INTO public.audit_logs (event_uuid, request_id, action, module, context_type, schema_version, created_at, updated_at)
VALUES (gen_random_uuid(), gen_random_uuid(), 'legacy.grant_probe', 'legacy', 'system', 1, now(), now());
INSERT INTO public.cache (key, value, expiration) VALUES ('pg-grant-probe', '1', 1);
UPDATE public.cache SET value = '2' WHERE key = 'pg-grant-probe';
DELETE FROM public.cache WHERE key = 'pg-grant-probe';
SELECT count(*) FROM public.audit_logs;
DO $probe$
BEGIN
  BEGIN
    UPDATE public.audit_logs SET reason = 'forbidden';
    RAISE EXCEPTION 'Runtime audit UPDATE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.audit_logs;
    RAISE EXCEPTION 'Runtime audit DELETE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE public.audit_logs;
    RAISE EXCEPTION 'Runtime audit TRUNCATE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    CREATE TABLE public.forbidden_runtime_table (id integer);
    RAISE EXCEPTION 'Runtime schema CREATE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.migrations;
    RAISE EXCEPTION 'Runtime migration history DELETE was unexpectedly permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$probe$;
ROLLBACK;
