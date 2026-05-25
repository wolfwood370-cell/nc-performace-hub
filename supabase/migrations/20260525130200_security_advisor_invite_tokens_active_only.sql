-- =============================================================================
-- Security Advisor fix — invite_tokens SELECT scope to active invites only
-- =============================================================================
-- Resolves 1 Lovable Supabase Advisor warning:
--
-- "Athlete invite tokens readable by coaches without scope restriction"
--
-- Advisor detail (3 sub-issues):
--
--   (a) "No expiry or used-status enforcement at the RLS layer — any
--       authenticated coach can read tokens including unused, valid ones
--       for other coaches' athletes if they somehow obtain the token UUID."
--       Note: the second clause ("for other coaches' athletes") is
--       misleading — the existing policy `coach_id = auth.uid()` already
--       prevents cross-coach reads. The REAL issue is sub-issue (a) proper:
--       a coach sees the FULL history of their own invites, including
--       already-used or expired ones, with the plaintext `token` value.
--       That's an unnecessarily long-lived exposure of secret material.
--
--   (b) "No policy allowing an invited athlete (pre-signup) to look up a
--       token by value to validate it client-side."
--       Not a real issue for this app: the invite flow does NOT do a
--       client-side token lookup. The athlete clicks the `/auth?token=...`
--       URL, the token is preserved purely as a routing hint (switch the
--       /auth page tab to signup + lock role to athlete). The actual
--       redemption happens server-side in the `handle_new_user` trigger
--       (SECURITY DEFINER, bypasses RLS) which matches by EMAIL, not by
--       token value. So no RPC is needed.
--
--   (c) "Verify no anon SELECT policy exists."
--       Already satisfied — the four policies on invite_tokens are all
--       gated on `coach_id = auth.uid()` so the `anon` role gets nothing.
--
-- Fix applied here (sub-issue a only):
--   DROP the four permissive policies and recreate them with an explicit
--   `used = false AND expires_at > now()` filter. After this migration:
--     - Coach can ONLY see/update/delete invites that are still actionable.
--     - Once an invite is marked `used = true` (by handle_new_user trigger)
--       or its `expires_at` passes, the row becomes invisible to the coach.
--     - The trigger itself (SECURITY DEFINER) still bypasses RLS, so the
--       redemption flow on signup is unaffected.
--
-- Side effect (intentional):
--   Coaches lose the ability to inspect historical invite logs from the
--   client. If a "view sent invites history" feature is added in the
--   future, it must go through a SECURITY DEFINER RPC that filters
--   sensitive columns (e.g. masks the `token` value).
-- =============================================================================

DROP POLICY IF EXISTS "Coaches can view their invites" ON public.invite_tokens;
DROP POLICY IF EXISTS "Coaches can update their invites" ON public.invite_tokens;
DROP POLICY IF EXISTS "Coaches can delete their invites" ON public.invite_tokens;
-- INSERT policy retained as-is (coach can always create new invites).

CREATE POLICY "Coaches can view active invites"
  ON public.invite_tokens
  FOR SELECT
  USING (
    coach_id = auth.uid()
    AND used = false
    AND expires_at > now()
  );

CREATE POLICY "Coaches can update active invites"
  ON public.invite_tokens
  FOR UPDATE
  USING (
    coach_id = auth.uid()
    AND used = false
    AND expires_at > now()
  )
  WITH CHECK (
    coach_id = auth.uid()
    -- Don't re-assert active here: the UPDATE may transition `used` to true
    -- via a client-side flow (legacy — most marking happens in the trigger).
  );

CREATE POLICY "Coaches can delete active invites"
  ON public.invite_tokens
  FOR DELETE
  USING (
    coach_id = auth.uid()
    AND used = false
    AND expires_at > now()
  );

COMMENT ON TABLE public.invite_tokens IS
  'Athlete onboarding invite tokens. Coach-side RLS restricts visibility to ACTIVE invites only (used=false AND not expired) to minimize exposure of plaintext token secret material. Redemption on signup happens in handle_new_user() trigger (SECURITY DEFINER, RLS bypass) matching by email — clients never call .from("invite_tokens").select() for the lookup itself.';
