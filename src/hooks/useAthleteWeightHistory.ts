import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { WeightPoint } from "@/lib/math/biometrics";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Loads the athlete's full body-weight history from `daily_metrics`,
 * sorted ascending by date. Falls back to `weight_kg` if the dedicated
 * `body_weight_kg` column is null.
 */
export function useAthleteWeightHistory() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: ["athlete-weight-history", userId],
    queryFn: async (): Promise<WeightPoint[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("daily_metrics")
        .select("date, body_weight_kg, weight_kg")
        .eq("user_id", userId)
        .order("date", { ascending: true })
        .limit(1000);

      if (error) throw error;

      return (data ?? [])
        .map((row) => {
          const raw = row.body_weight_kg ?? row.weight_kg;
          const scale = raw == null ? null : Number(raw);
          return scale == null || Number.isNaN(scale)
            ? null
            : { date: row.date as string, scale };
        })
        .filter((p): p is WeightPoint => p !== null);
    },
    enabled: !!userId,
    staleTime: FIVE_MINUTES,
    gcTime: FIVE_MINUTES * 4,
  });
}
