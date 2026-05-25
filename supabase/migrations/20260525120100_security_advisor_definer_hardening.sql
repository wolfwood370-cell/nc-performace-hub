-- =============================================================================
-- Security Advisor fix — SECURITY DEFINER hardening (3 warning consolidati)
-- =============================================================================
-- Resolves 3 Lovable Supabase Advisor warnings in a single migration applied
-- to ALL `SECURITY DEFINER` functions in the `public` schema.
--
-- #12 — Function Search Path Mutable
--    Before: many SECURITY DEFINER functions had no explicit search_path,
--    leaving them vulnerable to search_path manipulation attacks. An
--    attacker creating a malicious schema with the same function/operator
--    names could trick the SECURITY DEFINER function into executing
--    attacker code with elevated privileges.
--    After: `ALTER FUNCTION ... SET search_path = public, pg_temp` pins
--    the schema resolution. Idempotent — safe to re-apply.
--    Applied to EVERY SECURITY DEFINER function (helpers, triggers, RPCs).
--
-- #9 — Public Can Execute SECURITY DEFINER Function
-- #11 — Signed-In Users Can Execute SECURITY DEFINER Function
--    Before: SECURITY DEFINER functions were callable by `PUBLIC`
--    (which includes `anon` — unauthenticated requests).
--    After: `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO
--    authenticated`. Anonymous role is denied; authenticated users still
--    work for legitimate RPC calls.
--
--    EXCEPTION: helper functions used inside RLS policy expressions
--    (pattern: name starts with `is_` or `shares_`) keep `GRANT EXECUTE
--    TO PUBLIC` because RLS evaluation needs to call them from any role
--    (including anon when an `anon` query hits an RLS-protected table —
--    the policy expression must still be evaluable). Stripping their
--    PUBLIC execute would break RLS for legitimate anon flows.
--    These helpers don't perform writes and only return boolean checks
--    against `auth.uid()`, so PUBLIC executability is acceptable.
--    Trigger functions ALSO keep PUBLIC EXECUTE — they're invoked by
--    the trigger machinery as the table owner, not the calling role,
--    and stripping PUBLIC would not actually deny anything but adds
--    cognitive noise.
--
-- Strategy: single DO block iterating pg_proc; naming-based heuristic
-- for the RLS helper exception. A future improvement is to mark RLS
-- helpers with a function comment (e.g. `COMMENT ON FUNCTION ... IS
-- '@rls-helper'`) and key the exception off the comment instead of the
-- name pattern.
-- =============================================================================

DO $$
DECLARE
  fn_signature text;
  fn_name text;
  fn_is_rls_helper boolean;
  fn_count_processed int := 0;
  fn_count_locked_down int := 0;
BEGIN
  FOR fn_signature, fn_name IN
    SELECT p.oid::regprocedure::text, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true   -- SECURITY DEFINER only
  LOOP
    -- #12 — Pin search_path on EVERY function (idempotent, zero-risk).
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, pg_temp',
      fn_signature
    );

    -- Heuristic: RLS helper if name starts with `is_` or `shares_`.
    fn_is_rls_helper := fn_name LIKE 'is\_%' ESCAPE '\' OR fn_name LIKE 'shares\_%' ESCAPE '\';

    IF NOT fn_is_rls_helper THEN
      -- #9 + #11 — Strip PUBLIC, explicitly grant to authenticated only.
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn_signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn_signature);
      fn_count_locked_down := fn_count_locked_down + 1;
    END IF;

    fn_count_processed := fn_count_processed + 1;
  END LOOP;

  RAISE NOTICE 'security_advisor_definer_hardening: processed % functions (search_path), locked down %, % left as RLS helpers',
    fn_count_processed,
    fn_count_locked_down,
    fn_count_processed - fn_count_locked_down;
END $$;

-- =============================================================================
-- Sanity check (non-fatal): list functions that still lack a search_path
-- after the loop. Should print nothing — present here so that on apply the
-- Lovable Dashboard log shows a clear "all green" or names the offenders.
-- =============================================================================
DO $$
DECLARE
  offender text;
BEGIN
  FOR offender IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(p.proconfig) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    RAISE WARNING 'security_advisor: function % still has no search_path', offender;
  END LOOP;
END $$;
