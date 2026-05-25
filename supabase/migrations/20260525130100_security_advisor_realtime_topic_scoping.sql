-- =============================================================================
-- Security Advisor fix — Realtime channel topic scoping
-- =============================================================================
-- Tentative fix for Lovable Supabase Advisor warnings:
--
-- "Any authenticated user can subscribe to any Realtime channel topic"
-- "Any Authenticated User Can Create Subscriptions for Other Users"
--
-- Background:
--   Supabase Realtime v2 routes Broadcast/Presence messages through the
--   `realtime.messages` table, scoped by `realtime.topic()`. Without an
--   explicit RLS policy, the default permissive grant allows any
--   authenticated user to send/listen on any topic name, including topics
--   meant for another user (e.g. `coach-alerts-<other-user-id>`).
--
--   The application uses 5 channel naming conventions today:
--     - `room-<roomId>`             — chat (per-room, gated by chat_participants)
--     - `coach-alerts-<userId>`     — coach risk alerts (user-scoped)
--     - `notifications-<userId>`    — user notifications (user-scoped)
--     - `analytics-<athleteId>`     — workout analytics (athlete or coach-of)
--     - `live-sessions-realtime`    — coach live session board (all coaches)
--
--   For `postgres_changes` channels, RLS on the source tables already
--   filters the data payload — but the WARNING is about subscribing
--   itself (resource exhaustion / topic enumeration / cross-tenant leakage
--   of channel-presence metadata).
--
-- Lovable Cloud caveat:
--   The Security Agent report explicitly classifies `realtime.messages`
--   RLS as "ignored intentional — schema managed by Supabase". If this
--   migration fails at apply time because the `realtime` schema rejects
--   user-authored policies, the DO block catches the error and emits a
--   NOTICE so the deploy log clearly states the result rather than
--   silently failing.
--
-- Strategy:
--   Wrap the policy creation in a DO block with exception handling.
--   Successful apply → policy active, Advisor warning should clear.
--   `insufficient_privilege` or `undefined_table` → log + continue.
--
-- Rollback plan:
--   `DROP POLICY IF EXISTS "topic_scoping" ON realtime.messages;`
--   then re-deploy. Application chat / alerts / notifications return to
--   the pre-migration permissive behavior immediately.
-- =============================================================================

DO $$
BEGIN
  -- Drop any prior version of this policy (idempotent re-apply)
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "topic_scoping" ON realtime.messages';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'realtime_topic_scoping: cannot drop existing policy (%): %', SQLSTATE, SQLERRM;
  END;

  -- Create the topic-scoping policy
  BEGIN
    EXECUTE $POLICY$
      CREATE POLICY "topic_scoping"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        -- coach-alerts-<userId> → only the matching user
        realtime.topic() = 'coach-alerts-' || auth.uid()::text
        OR
        -- notifications-<userId> → only the matching user
        realtime.topic() = 'notifications-' || auth.uid()::text
        OR
        -- analytics-<athleteId> → the athlete OR their coach
        (
          realtime.topic() LIKE 'analytics-%'
          AND (
            substring(realtime.topic() FROM 11) = auth.uid()::text
            OR public.is_coach_of_athlete(substring(realtime.topic() FROM 11)::uuid)
          )
        )
        OR
        -- room-<roomId> → must be a chat participant
        (
          realtime.topic() LIKE 'room-%'
          AND EXISTS (
            SELECT 1
            FROM public.chat_participants
            WHERE room_id::text = substring(realtime.topic() FROM 6)
              AND user_id = auth.uid()
          )
        )
        OR
        -- live-sessions-realtime → all authenticated users
        --   TODO: tighten to role='coach' once we have a fast helper
        realtime.topic() = 'live-sessions-realtime'
      )
    $POLICY$;
    RAISE NOTICE 'realtime_topic_scoping: policy applied successfully';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'realtime_topic_scoping: BLOCKED by managed schema permission (insufficient_privilege). Advisor warning will persist. This is the expected Lovable Cloud behavior per security report; consider opening a Lovable support ticket.';
    WHEN undefined_table THEN
      RAISE NOTICE 'realtime_topic_scoping: realtime.messages table not found — Supabase Realtime v2 may not be active. Skipping.';
    WHEN undefined_function THEN
      RAISE NOTICE 'realtime_topic_scoping: realtime.topic() function unavailable — Supabase Realtime version too old. Skipping.';
    WHEN OTHERS THEN
      RAISE NOTICE 'realtime_topic_scoping: unexpected error (%): %', SQLSTATE, SQLERRM;
  END;
END $$;
