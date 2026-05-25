
-- 1. Protect sensitive profile fields via trigger (non-service-role updates only)
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / postgres bypass this trigger
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Changing role is not allowed';
  END IF;
  IF NEW.coach_id IS DISTINCT FROM OLD.coach_id THEN
    RAISE EXCEPTION 'Changing coach_id is not allowed';
  END IF;
  IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier THEN
    RAISE EXCEPTION 'Changing subscription_tier is not allowed';
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Changing subscription_status is not allowed';
  END IF;
  IF NEW.current_period_end IS DISTINCT FROM OLD.current_period_end THEN
    RAISE EXCEPTION 'Changing current_period_end is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2. Remove client-facing UPDATE on ai_usage_tracking (server-only writes)
DROP POLICY IF EXISTS "Users can update own usage" ON public.ai_usage_tracking;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.ai_usage_tracking;

-- 3. Remove client-facing INSERT/UPDATE on leaderboard_cache (server-only writes)
DROP POLICY IF EXISTS "Users can update own leaderboard" ON public.leaderboard_cache;
DROP POLICY IF EXISTS "Users can upsert own leaderboard" ON public.leaderboard_cache;
