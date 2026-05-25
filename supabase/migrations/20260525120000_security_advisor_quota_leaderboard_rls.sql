-- =============================================================================
-- Security Advisor fix — restrict AI quota + leaderboard writes to service role
-- =============================================================================
-- Resolves 2 Lovable Supabase Advisor warnings:
--
-- #7 — AI Rate Limit Bypassed by Direct Table Write
--    Before: `ai_usage_tracking` had RLS policies allowing the user to INSERT
--    their own row and UPDATE their own counter. A malicious authenticated
--    client could reset `message_count = 0` directly via the REST API and
--    bypass the daily AI quota entirely.
--    After: writes (INSERT, UPDATE, DELETE) are restricted to the service
--    role. The edge function `chat-with-coach` uses a service-role client
--    for these operations. Users keep SELECT on their own row so the FE
--    `useAiQuota` hook still works. Coaches keep UPDATE for the `daily_limit`
--    field (gated by ownership policy) — a future improvement is to expose
--    this via an RPC so only the `daily_limit` column can be touched.
--
-- #8 — Athletes Can Self-Inflate Leaderboard Stats via Unrestricted UPDATE
--    Before: `leaderboard_cache` had RLS allowing the user to INSERT and
--    UPDATE their own row. An athlete could set `week_volume = 999999999`
--    and game the leaderboard.
--    After: writes are restricted to the service role. The leaderboard is
--    server-computed; users only ever read it.
-- =============================================================================

-- =============================================================================
-- #7 — ai_usage_tracking: remove user-side INSERT/UPDATE
-- =============================================================================

-- The original migration (20260215171751_dc1d5d0f-...) created:
--   - "Users can insert own usage" FOR INSERT
--   - "Users can update own usage" FOR UPDATE
-- Both are now dropped. The edge function chat-with-coach is refactored
-- in the same commit to use SUPABASE_SERVICE_ROLE_KEY for these writes.

DROP POLICY IF EXISTS "Users can insert own usage" ON public.ai_usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON public.ai_usage_tracking;

-- We deliberately keep the existing SELECT policies (self + coach view)
-- and the coach-level UPDATE policy (for adjusting daily_limit).
-- TODO: replace "Coaches can update athlete limits" with a SECURITY DEFINER
-- RPC `set_athlete_daily_limit(athlete_id uuid, new_limit int)` so coaches
-- cannot touch `message_count` / `last_reset_at` either.

COMMENT ON TABLE public.ai_usage_tracking IS
  'AI usage quota per user. Writes restricted to service role (see chat-with-coach edge fn). Users only SELECT their own row via the useAiQuota hook.';

-- =============================================================================
-- #8 — leaderboard_cache: remove user-side INSERT/UPDATE
-- =============================================================================

-- The original migration (20260215213206_cd28d8b6-...) created:
--   - "Users can upsert own leaderboard" FOR INSERT
--   - "Users can update own leaderboard" FOR UPDATE
-- Both are now dropped. The leaderboard is recomputed server-side
-- (currently no edge function exists; the table is fed by a future
-- scheduled job or batch process — until then it stays empty/static
-- which is the safe default).

DROP POLICY IF EXISTS "Users can upsert own leaderboard" ON public.leaderboard_cache;
DROP POLICY IF EXISTS "Users can update own leaderboard" ON public.leaderboard_cache;

-- We deliberately keep the SELECT policies (athletes see same-coach
-- leaderboard; coaches see their own roster).

COMMENT ON TABLE public.leaderboard_cache IS
  'Server-computed leaderboard snapshot. Writes restricted to service role only (no edge fn populates this yet — placeholder for future scheduled job). Users only SELECT.';
