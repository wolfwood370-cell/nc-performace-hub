-- =============================================================================
-- Security Advisor fix — Coach AI limits: column-granular update via RPC
-- =============================================================================
-- Resolves 1 Lovable Supabase Advisor warning:
--
-- "Coaches can modify AI daily limits for their athletes"
--
-- Background:
--   Migration 20260215171751 created `ai_usage_tracking` with 4 RLS policies:
--     - "Users can view own usage" (SELECT, self)
--     - "Users can insert own usage" (INSERT, self) — dropped by 20260525120000
--     - "Users can update own usage" (UPDATE, self) — dropped by 20260525120000
--     - "Coaches can view athlete usage" (SELECT, ownership)
--     - "Coaches can update athlete limits" (UPDATE, ownership)
--
--   The "Coaches can update athlete limits" policy was permissive on the row
--   level: a coach could UPDATE ANY column on the athlete's row, including
--   `message_count` (reset quota mid-day) and `last_reset_at`. Only
--   `daily_limit` was the intended writable field.
--
--   PostgreSQL RLS policies cannot express column-level WITH CHECK, so the
--   only safe path is: drop the policy, expose a granular RPC.
--
-- After this migration:
--   - Policy "Coaches can update athlete limits" is dropped.
--   - New RPC `set_athlete_daily_limit(p_athlete_id uuid, p_daily_limit int)`
--     SECURITY DEFINER:
--       * Verifies caller is the athlete's coach via is_coach_of_athlete().
--       * Updates ONLY the daily_limit column.
--       * Clamps the value to [1, 1000] to prevent absurd inputs.
--       * Throws on any precondition violation.
--   - Coach FE must be updated to call the RPC instead of `.from('ai_usage_tracking').update(...)`.
--     (Today no FE code references this — the policy was infrastructure-ready
--     but unused. The RPC is the safe forward-compatible interface.)
-- =============================================================================

DROP POLICY IF EXISTS "Coaches can update athlete limits" ON public.ai_usage_tracking;

CREATE OR REPLACE FUNCTION public.set_athlete_daily_limit(
  p_athlete_id uuid,
  p_daily_limit int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Authorization: caller must be the athlete's coach.
  IF NOT public.is_coach_of_athlete(p_athlete_id) THEN
    RAISE EXCEPTION 'Forbidden: not the athlete''s coach';
  END IF;

  -- Input bounds — sanity clamp.
  IF p_daily_limit < 1 OR p_daily_limit > 1000 THEN
    RAISE EXCEPTION 'daily_limit out of range (1..1000), got %', p_daily_limit;
  END IF;

  -- Upsert the daily_limit column ONLY. message_count and last_reset_at
  -- are left untouched (managed by the chat-with-coach edge function).
  INSERT INTO public.ai_usage_tracking (user_id, daily_limit)
    VALUES (p_athlete_id, p_daily_limit)
    ON CONFLICT (user_id) DO UPDATE
      SET daily_limit = EXCLUDED.daily_limit;
END;
$$;

-- Lock down execution: only authenticated users (coaches) can attempt to call.
-- The auth check inside the RPC body enforces the actual coach→athlete bond.
REVOKE EXECUTE ON FUNCTION public.set_athlete_daily_limit(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_athlete_daily_limit(uuid, int) TO authenticated;

COMMENT ON FUNCTION public.set_athlete_daily_limit(uuid, int) IS
  'Coach-only granular update of ai_usage_tracking.daily_limit. Authorization via is_coach_of_athlete(). Range clamp 1..1000. Other columns (message_count, last_reset_at) are managed exclusively by the chat-with-coach edge function via service role.';
