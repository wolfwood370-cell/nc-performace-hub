/**
 * src/pages/coach/athlete-detail/ProgramTab.tsx
 * ---------------------------------------------------------------------------
 * Athlete detail page — Program tab (weekly microcycle view).
 *
 * Extracted from `AthleteDetail.tsx` as PR2 of the C3 refactor.
 * Same "fat-props" pattern as OverviewTab: parent stays the single
 * source of truth for derived data; no queries here.
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Play, ChevronRight, CheckCircle2, XCircle, Clock, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CurrentPhase {
  name: string | null;
  start_date: string;
  end_date: string;
  focus_type: string | null;
}

interface PhaseProgress {
  currentWeek: number;
  totalWeeks: number;
  daysRemaining: number;
  percentage: number;
}

interface ScheduledDay {
  dayName: string;
  dayNumber: number | string;
  isToday: boolean;
  isFuture: boolean;
  status: "completed" | "missed" | "scheduled" | "rest";
  workout: {
    title: string;
    estimated_duration: number | null;
  } | null;
}

interface ProgramWeeklyStats {
  totalSets: number;
  workoutsCompleted: number;
  workoutsPlanned: number;
  focusTypes: string[];
}

export interface ProgramTabProps {
  athleteId: string;
  currentPhase: CurrentPhase | null;
  phaseProgress: PhaseProgress | null;
  weeklySchedule: ScheduledDay[];
  weeklyStats: ProgramWeeklyStats;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgramTab({
  athleteId,
  currentPhase,
  phaseProgress,
  weeklySchedule,
  weeklyStats,
}: ProgramTabProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* 1. Active Phase Header */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Dumbbell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">
                  {currentPhase?.name || "Nessun Programma Attivo"}
                </CardTitle>
                {currentPhase && (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(currentPhase.start_date), "d MMM", { locale: it })}
                    {" - "}
                    {format(new Date(currentPhase.end_date), "d MMM yyyy", { locale: it })}
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={() => navigate(`/coach/programs?athlete=${athleteId}`)}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Apri Program Builder
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        {phaseProgress && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Settimana {phaseProgress.currentWeek} di {phaseProgress.totalWeeks}
                </span>
                <span className="font-medium text-foreground">
                  {phaseProgress.daysRemaining} giorni rimanenti
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${phaseProgress.percentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        )}
        {!currentPhase && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              Nessuna fase di allenamento attiva. Crea un programma per questo atleta.
            </p>
          </CardContent>
        )}
      </Card>

      {/* 2. Weekly Microcycle Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Settimana Corrente
        </h3>

        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-7 gap-3">
          {weeklySchedule.map((day, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-xl border transition-all",
                day.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                day.isFuture && "opacity-60",
              )}
            >
              <div
                className={cn(
                  "px-3 py-2 border-b text-center",
                  day.isToday ? "bg-primary/10" : "bg-muted/30",
                )}
              >
                <p className="text-xs font-medium text-muted-foreground uppercase">{day.dayName}</p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    day.isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {day.dayNumber}
                </p>
              </div>

              <div className="p-3 min-h-[140px]">
                {day.workout ? (
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center mx-auto",
                        day.status === "completed" && "bg-success text-success-foreground",
                        day.status === "missed" && "bg-destructive text-destructive-foreground",
                        day.status === "scheduled" && "bg-primary/20 text-primary",
                      )}
                    >
                      {day.status === "completed" && <CheckCircle2 className="h-4 w-4" />}
                      {day.status === "missed" && <XCircle className="h-4 w-4" />}
                      {day.status === "scheduled" && <Dumbbell className="h-3 w-3" />}
                    </div>

                    <div className="text-center">
                      <p className="text-sm font-medium line-clamp-2">{day.workout.title}</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-1">
                      {day.workout.estimated_duration && (
                        <Badge variant="secondary" className="text-3xs px-1.5 py-0">
                          <Clock className="h-2.5 w-2.5 mr-0.5" />
                          {day.workout.estimated_duration}m
                        </Badge>
                      )}
                      {currentPhase?.focus_type && (
                        <Badge variant="outline" className="text-3xs px-1.5 py-0 capitalize">
                          {currentPhase.focus_type.replace("_", "")}
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
                    <Coffee className="h-6 w-6 mb-1" />
                    <span className="text-xs">Giorno di Riposo</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Stack */}
        <div className="md:hidden space-y-2">
          {weeklySchedule.map((day, idx) => (
            <Card
              key={idx}
              className={cn(
                "overflow-hidden transition-all",
                day.isToday && "ring-2 ring-primary",
                day.isFuture && "opacity-60",
              )}
            >
              <div className="flex items-center gap-3 p-3">
                <div
                  className={cn(
                    "w-14 h-14 rounded-lg flex flex-col items-center justify-center flex-shrink-0",
                    day.isToday ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <span className="text-3xs uppercase font-medium">{day.dayName}</span>
                  <span className="text-xl font-bold">{day.dayNumber}</span>
                </div>

                <div className="flex-1 min-w-0">
                  {day.workout ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{day.workout.title}</p>
                        {day.status === "completed" && (
                          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                        )}
                        {day.status === "missed" && (
                          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {day.workout.estimated_duration && (
                          <span className="text-xs text-muted-foreground">
                            {day.workout.estimated_duration} min
                          </span>
                        )}
                        {currentPhase?.focus_type && (
                          <Badge variant="outline" className="text-3xs capitalize">
                            {currentPhase.focus_type.replace("_", "")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Coffee className="h-4 w-4" />
                      <span className="text-sm">Giorno di Riposo</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 3. Quick Stats Footer */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{weeklyStats.totalSets}</p>
                <p className="text-xs text-muted-foreground">Serie Totali</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {weeklyStats.workoutsCompleted}/{weeklyStats.workoutsPlanned}
                </p>
                <p className="text-xs text-muted-foreground">Workouts</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Focus:</span>
              {weeklyStats.focusTypes.length > 0 ? (
                weeklyStats.focusTypes.map((focus, idx) => (
                  <Badge key={idx} variant="secondary" className="capitalize">
                    {focus.replace("_", "")}
                  </Badge>
                ))
              ) : currentPhase?.focus_type ? (
                <Badge variant="secondary" className="capitalize">
                  {currentPhase.focus_type.replace("_", "")}
                </Badge>
              ) : (
                <Badge variant="outline">None</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
