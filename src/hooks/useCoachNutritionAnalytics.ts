import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, format, eachDayOfInterval } from "date-fns";

export interface NutritionAnalyticsPoint {
  date: string;
  dateFormatted: string;
  loggedCalories: number | null;
  targetCalories: number | null;
  weight: number | null;
}

export interface NutritionAnalyticsResult {
  data: NutritionAnalyticsPoint[];
  targetCalories: number | null;
  adherencePct: number;
  avgDelta: number;
  weightChange: number | null;
  hasData: boolean;
}

const FIVE_MINUTES = 5 * 60 * 1000;

export function useCoachNutritionAnalytics(athleteId: string | undefined) {
  return useQuery<NutritionAnalyticsResult>({
    queryKey: ["coach-nutrition-analytics", athleteId],
    enabled: !!athleteId,
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      const empty: NutritionAnalyticsResult = {
        data: [],
        targetCalories: null,
        adherencePct: 0,
        avgDelta: 0,
        weightChange: null,
        hasData: false,
      };
      if (!athleteId) return empty;

      const today = new Date();
      const start = subDays(today, 29);
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(today, "yyyy-MM-dd");

      const [planRes, sumRes, weightRes] = await Promise.all([
        supabase
          .from("nutrition_plans")
          .select("daily_calories")
          .eq("athlete_id", athleteId)
          .eq("active", true)
          .maybeSingle(),
        supabase
          .from("nutrition_daily_summary")
          .select("date, total_calories")
          .eq("athlete_id", athleteId)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("body_measurements")
          .select("date, weight_kg")
          .eq("athlete_id", athleteId)
          .gte("date", startStr)
          .lte("date", endStr)
          .order("date", { ascending: true }),
      ]);

      const targetCalories = planRes.data?.daily_calories ?? null;

      const sumMap = new Map<string, number>();
      (sumRes.data ?? []).forEach((r: any) => sumMap.set(r.date, Number(r.total_calories)));

      const weightMap = new Map<string, number>();
      (weightRes.data ?? []).forEach((r: any) => {
        if (r.weight_kg != null) weightMap.set(r.date, Number(r.weight_kg));
      });

      const days = eachDayOfInterval({ start, end: today });
      const data: NutritionAnalyticsPoint[] = days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        return {
          date: key,
          dateFormatted: format(d, "dd MMM"),
          loggedCalories: sumMap.has(key) ? sumMap.get(key)! : null,
          targetCalories,
          weight: weightMap.has(key) ? weightMap.get(key)! : null,
        };
      });

      // Adherence: % of logged days within ±5% of target
      const loggedDays = data.filter((d) => d.loggedCalories != null);
      let adherencePct = 0;
      if (targetCalories && loggedDays.length > 0) {
        const tol = targetCalories * 0.05;
        const within = loggedDays.filter(
          (d) => Math.abs((d.loggedCalories as number) - targetCalories) <= tol,
        ).length;
        adherencePct = Math.round((within / loggedDays.length) * 100);
      }

      // Avg delta logged - target
      let avgDelta = 0;
      if (targetCalories && loggedDays.length > 0) {
        const sum = loggedDays.reduce(
          (acc, d) => acc + ((d.loggedCalories as number) - targetCalories),
          0,
        );
        avgDelta = Math.round(sum / loggedDays.length);
      }

      // Weight change: last - first measured
      const measured = (weightRes.data ?? []).filter((r: any) => r.weight_kg != null);
      let weightChange: number | null = null;
      if (measured.length >= 2) {
        const first = Number(measured[0].weight_kg);
        const last = Number(measured[measured.length - 1].weight_kg);
        weightChange = Number((last - first).toFixed(1));
      }

      return {
        data,
        targetCalories,
        adherencePct,
        avgDelta,
        weightChange,
        hasData: loggedDays.length > 0 || weightMap.size > 0,
      };
    },
  });
}
