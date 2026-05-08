import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveSessionStore } from "@/stores/useActiveSessionStore";

const DEBOUNCE_MS = 3000;

/**
 * Background autosave for in-progress workout sessions.
 *
 * - Watches Zustand `sessionLogs` for changes.
 * - After 3s of inactivity, silently upserts the current state into
 *   `workout_logs.exercises_data` with `status = 'in_progress'`.
 * - On mount, if the local store is empty but an `in_progress` log exists
 *   for today, hydrates the store from the cloud (graceful recovery).
 */
export function useWorkoutAutosave() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- 1. Graceful Recovery on mount ----------
  useEffect(() => {
    if (!userId || hydratedRef.current) return;
    hydratedRef.current = true;

    const state = useActiveSessionStore.getState();
    if (state.isActive && state.workoutId) return; // already running locally

    const today = format(new Date(), "yyyy-MM-dd");
    (async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, workout_id, exercises_data, started_at")
        .eq("athlete_id", userId)
        .eq("status", "in_progress")
        .eq("scheduled_date", today)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data?.workout_id) return;

      const sessionLogs =
        (data.exercises_data as Record<string, unknown> | null) ?? {};

      useActiveSessionStore.setState({
        activeSessionId: data.id,
        workoutId: data.workout_id,
        sessionLogs: sessionLogs as never,
        startedAt: data.started_at ?? new Date().toISOString(),
        isActive: true,
        pendingSync: false,
      });
      lastSavedRef.current = JSON.stringify(sessionLogs);
    })();
  }, [userId]);

  // ---------- 2. Debounced background flush ----------
  useEffect(() => {
    if (!userId) return;

    const flush = async () => {
      const { workoutId, sessionLogs, activeSessionId, startedAt, isActive } =
        useActiveSessionStore.getState();
      if (!isActive || !workoutId) return;

      const serialized = JSON.stringify(sessionLogs);
      if (serialized === lastSavedRef.current) return;

      const exercisesData = JSON.parse(serialized);
      const today = format(new Date(), "yyyy-MM-dd");

      try {
        const { error, count } = await supabase
          .from("workout_logs")
          .update(
            {
              status: "in_progress",
              exercises_data: exercisesData,
              started_at: startedAt ?? new Date().toISOString(),
            },
            { count: "exact" },
          )
          .eq("athlete_id", userId)
          .eq("workout_id", workoutId);

        if (error) throw error;

        if ((count ?? 0) === 0) {
          await supabase.from("workout_logs").insert([
            {
              athlete_id: userId,
              workout_id: workoutId,
              status: "in_progress",
              scheduled_date: today,
              exercises_data: exercisesData,
              started_at: startedAt ?? new Date().toISOString(),
              local_id: activeSessionId,
            },
          ]);
        }

        lastSavedRef.current = serialized;
      } catch (err) {
        // Silent failure — next debounce cycle will retry.
        console.warn("[autosave] workout_logs flush failed", err);
      }
    };

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    };

    // Subscribe to store changes; only react when sessionLogs reference changes.
    let prevLogs = useActiveSessionStore.getState().sessionLogs;
    const unsub = useActiveSessionStore.subscribe((s) => {
      if (s.sessionLogs !== prevLogs) {
        prevLogs = s.sessionLogs;
        schedule();
      }
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userId]);
}
