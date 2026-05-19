import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addDays, isAfter, isBefore } from "date-fns";
import { it } from "date-fns/locale";
import {
  X,
  Calendar,
  Dumbbell,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ChatRoom } from "@/hooks/useChatRooms";
import { useAuth } from "@/hooks/useAuth";

interface AthleteContextPaneProps {
  room: ChatRoom | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AthleteContextPane({ room, isOpen, onClose }: AthleteContextPaneProps) {
  const { user } = useAuth();

  // Get the athlete ID from the room (other participant)
  const athleteId =
    room?.type === "direct" ? room.participants.find((p) => p.user_id !== user?.id)?.user_id : null;

  const athleteProfile = room?.participants.find((p) => p.user_id === athleteId)?.profile;

  // Fetch athlete's workout data
  const { data: workoutData, isLoading: workoutsLoading } = useQuery({
    queryKey: ["athlete-context-workouts", athleteId],
    queryFn: async () => {
      if (!athleteId) return null;

      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const nextThreeDays = addDays(today, 3);

      // Get last completed workout
      const { data: lastCompleted } = await supabase
        .from("workout_logs")
        .select(
          "id, scheduled_date, completed_at, rpe_global, duration_minutes, workout:workouts(title)",
        )
        .eq("athlete_id", athleteId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .single();

      // Get next scheduled workout
      const { data: nextScheduled } = await supabase
        .from("workout_logs")
        .select("id, scheduled_date, workout:workouts(title)")
        .eq("athlete_id", athleteId)
        .eq("status", "scheduled")
        .gte("scheduled_date", format(today, "yyyy-MM-dd"))
        .order("scheduled_date", { ascending: true })
        .limit(1)
        .single();

      // Get this week's workouts for compliance
      const { data: weekWorkouts } = await supabase
        .from("workout_logs")
        .select("id, status, scheduled_date")
        .eq("athlete_id", athleteId)
        .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"));

      // Get next 3 days of scheduled workouts
      const { data: upcomingWorkouts } = await supabase
        .from("workout_logs")
        .select("id, scheduled_date, workout:workouts(title)")
        .eq("athlete_id", athleteId)
        .eq("status", "scheduled")
        .gte("scheduled_date", format(today, "yyyy-MM-dd"))
        .lte("scheduled_date", format(nextThreeDays, "yyyy-MM-dd"))
        .order("scheduled_date", { ascending: true });

      // Calculate compliance
      const total = weekWorkouts?.length || 0;
      const completed = weekWorkouts?.filter((w) => w.status === "completed").length || 0;
      const missed =
        weekWorkouts?.filter(
          (w) => w.status === "scheduled" && isBefore(new Date(w.scheduled_date), today),
        ).length || 0;

      // Supabase nested-relation alias (`workout:workouts(title)`) types
      // the embedded payload as `unknown`. Narrow it locally here so the
      // `(w.workout as any).title` cast is no longer needed.
      const titleOf = (row: { workout?: { title?: string | null } | null } | null): string =>
        row?.workout?.title ?? "Allenamento";

      return {
        lastCompleted: lastCompleted
          ? { ...lastCompleted, workoutTitle: titleOf(lastCompleted) }
          : null,
        nextScheduled: nextScheduled
          ? { ...nextScheduled, workoutTitle: titleOf(nextScheduled) }
          : null,
        upcoming:
          upcomingWorkouts?.map((w) => ({
            ...w,
            workoutTitle: titleOf(w),
          })) || [],
        compliance: {
          total,
          completed,
          missed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
      };
    },
    enabled: !!athleteId && isOpen,
  });

  // Fetch athlete's readiness data
  const { data: readinessData, isLoading: readinessLoading } = useQuery({
    queryKey: ["athlete-context-readiness", athleteId],
    queryFn: async () => {
      if (!athleteId) return null;

      const { data } = await supabase
        .from("daily_readiness")
        .select("date, score, energy, sleep_quality, mood")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(7);

      return data || [];
    },
    enabled: !!athleteId && isOpen,
  });

  if (!room || room.type !== "direct") {
    return null;
  }

  const isLoading = workoutsLoading || readinessLoading;

  return (
    <div
      className={cn(
        "h-full flex flex-col bg-card border-l",
        "lg:relative lg:translate-x-0",
        "fixed inset-y-0 right-0 w-80 z-50",
        "transform transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
      )}
    >
      {/* Header */}
      <div className="h-14 shrink-0 border-b flex items-center justify-between px-4">
        <h3 className="font-semibold">Contesto Atleta</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Athlete Info */}
          <div className="text-center pb-4 border-b">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <span className="text-lg font-semibold text-primary">
                {athleteProfile?.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "U"}
              </span>
            </div>
            <h4 className="font-medium">{athleteProfile?.full_name || "Atleta"}</h4>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : (
            <>
              {/* Mini Calendar - Next 3 Days */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Prossimi Allenamenti
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  {workoutData?.upcoming.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nessun allenamento programmato
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {workoutData?.upcoming.map((workout, i) => (
                        <div
                          key={workout.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                        >
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {format(new Date(workout.scheduled_date), "d")}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{workout.workoutTitle}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {format(new Date(workout.scheduled_date), "EEEE", { locale: it })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Last Workout */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    Ultimo Allenamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  {!workoutData?.lastCompleted ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nessun allenamento completato
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {workoutData.lastCompleted.workoutTitle}
                        </span>
                        {workoutData.lastCompleted.rpe_global &&
                        workoutData.lastCompleted.rpe_global > 8 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            RPE {workoutData.lastCompleted.rpe_global}
                          </Badge>
                        ) : workoutData.lastCompleted.rpe_global ? (
                          <Badge variant="secondary">
                            RPE {workoutData.lastCompleted.rpe_global}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(
                            new Date(
                              workoutData.lastCompleted.completed_at ||
                                workoutData.lastCompleted.scheduled_date,
                            ),
                            "d MMM",
                            { locale: it },
                          )}
                        </span>
                        {workoutData.lastCompleted.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {workoutData.lastCompleted.duration_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weekly Compliance */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Compliance Settimanale
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Completati</span>
                      <span className="font-medium">
                        {workoutData?.compliance.completed}/{workoutData?.compliance.total}
                      </span>
                    </div>
                    <Progress value={workoutData?.compliance.percentage || 0} className="h-2" />
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {workoutData?.compliance.completed} fatti
                      </span>
                      {(workoutData?.compliance.missed || 0) > 0 && (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {workoutData?.compliance.missed} saltati
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Readiness */}
              {readinessData && readinessData.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">Readiness Recente</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="flex items-end gap-1 h-12">
                      {readinessData
                        .slice(0, 7)
                        .reverse()
                        .map((day, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-primary/20 rounded-t"
                            style={{
                              height: `${((day.score || 50) / 100) * 100}%`,
                              opacity: 0.4 + i * 0.1,
                            }}
                            title={`${format(new Date(day.date), "d MMM", { locale: it })}: ${day.score || "-"}`}
                          />
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                      <span>7 giorni fa</span>
                      <span>Oggi</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
