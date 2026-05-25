import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on workout_logs.
 * When an athlete completes/updates a workout, all analytics queries
 * for that athlete are automatically invalidated so charts refresh live.
 */
export function useRealtimeAnalytics(athleteId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!athleteId) return;

    const channelName = `analytics-${athleteId}`;

    // Defensive: remove any stale channel with this topic before re-subscribing.
    // See useCoachAlerts.ts for full rationale (HMR / singleton client race).
    supabase
      .getChannels()
      .filter((c) => c.topic === `realtime:${channelName}`)
      .forEach((c) => {
        supabase.removeChannel(c);
      });

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workout_logs",
          filter: `athlete_id=eq.${athleteId}`,
        },
        () => {
          // Invalidate all analytics queries for this athlete
          queryClient.invalidateQueries({ queryKey: ["athlete-volume-intensity", athleteId] });
          queryClient.invalidateQueries({ queryKey: ["athlete-strength", athleteId] });
          queryClient.invalidateQueries({ queryKey: ["athlete-metabolic", athleteId] });
          queryClient.invalidateQueries({ queryKey: ["athlete-exercise-list", athleteId] });
          queryClient.invalidateQueries({ queryKey: ["athlete-acwr", athleteId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [athleteId, queryClient]);
}
