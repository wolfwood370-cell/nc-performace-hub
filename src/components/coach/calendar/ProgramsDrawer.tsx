import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  FolderOpen,
  Calendar,
  Dumbbell,
  GripVertical,
  ChevronRight,
  Search,
  FileStack,
  Layout,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgramPlan {
  id: string;
  name: string;
  description: string | null;
  is_template: boolean;
}

interface ProgramWeek {
  id: string;
  program_plan_id: string;
  week_order: number;
  name: string | null;
}

interface ProgramDay {
  id: string;
  program_week_id: string;
  day_number: number;
  name: string | null;
}

interface ProgramWorkout {
  id: string;
  program_day_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  day_number?: number;
}

interface WeekWithWorkouts extends ProgramWeek {
  workouts: ProgramWorkout[];
  days: ProgramDay[];
}

interface PlanWithWeeks extends ProgramPlan {
  weeks: WeekWithWorkouts[];
}

// Draggable Workout Item
function DraggableWorkout({
  workout,
  weekId,
  planId,
}: {
  workout: ProgramWorkout;
  weekId: string;
  planId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `calendar-workout-${workout.id}`,
    data: {
      type: "calendar-workout",
      workout,
      weekId,
      planId,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-all cursor-grab active:cursor-grabbing group shadow-sm",
        isDragging && "ring-2 ring-primary shadow-lg",
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity shrink-0" />
      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Dumbbell className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{workout.name}</p>
        {workout.day_number !== undefined && (
          <p className="text-3xs text-muted-foreground">Giorno {workout.day_number}</p>
        )}
      </div>
    </div>
  );
}

// Draggable Week Item (for Smart Paste)
function DraggableWeek({
  week,
  planId,
  workoutCount,
}: {
  week: ProgramWeek;
  planId: string;
  workoutCount: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `calendar-week-${week.id}`,
    data: {
      type: "calendar-week",
      week,
      planId,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg bg-accent/50 hover:bg-accent cursor-grab active:cursor-grabbing transition-colors",
        isDragging && "ring-2 ring-primary shadow-lg",
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Calendar className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-medium flex-1 truncate">
        {week.name || `Settimana ${week.week_order}`}
      </span>
      <Badge variant="secondary" className="text-3xs h-5 px-2">
        {workoutCount} workout
      </Badge>
    </div>
  );
}

export function ProgramsDrawer() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"programs" | "templates">("programs");
  const [expandedPlans, setExpandedPlans] = useState<string[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);

  // Fetch all program plans with nested structure
  const { data: allPrograms = [], isLoading } = useQuery({
    queryKey: ["calendar-programs", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // 1. Fetch all program plans
      const { data: plans, error: plansError } = await supabase
        .from("program_plans")
        .select("*")
        .eq("coach_id", user.id)
        .order("updated_at", { ascending: false });

      if (plansError) throw plansError;
      if (!plans?.length) return [];

      // 2. Fetch all weeks for these plans
      const planIds = plans.map((p) => p.id);
      const { data: weeks, error: weeksError } = await supabase
        .from("program_weeks")
        .select("*")
        .in("program_plan_id", planIds)
        .order("week_order", { ascending: true });

      if (weeksError) throw weeksError;

      // 3. Fetch all days for these weeks
      const weekIds = weeks?.map((w) => w.id) || [];
      const { data: days, error: daysError } = await supabase
        .from("program_days")
        .select("*")
        .in("program_week_id", weekIds)
        .order("day_number", { ascending: true });

      if (daysError) throw daysError;

      // 4. Fetch all workouts for these days
      const dayIds = days?.map((d) => d.id) || [];
      const { data: workouts, error: workoutsError } = await supabase
        .from("program_workouts")
        .select("*")
        .in("program_day_id", dayIds)
        .order("sort_order", { ascending: true });

      if (workoutsError) throw workoutsError;

      // 5. Build nested structure
      const daysMap = new Map<string, ProgramDay[]>();
      days?.forEach((day) => {
        const existing = daysMap.get(day.program_week_id) || [];
        existing.push(day);
        daysMap.set(day.program_week_id, existing);
      });

      const workoutsMap = new Map<string, ProgramWorkout[]>();
      workouts?.forEach((workout) => {
        const day = days?.find((d) => d.id === workout.program_day_id);
        const workoutWithDay = { ...workout, day_number: day?.day_number };

        const existing = workoutsMap.get(workout.program_day_id) || [];
        existing.push(workoutWithDay);
        workoutsMap.set(workout.program_day_id, existing);
      });

      // Group workouts by week
      const weekWorkoutsMap = new Map<string, ProgramWorkout[]>();
      weeks?.forEach((week) => {
        const weekDays = daysMap.get(week.id) || [];
        const allWorkouts: ProgramWorkout[] = [];
        weekDays.forEach((day) => {
          const dayWorkouts = workoutsMap.get(day.id) || [];
          allWorkouts.push(...dayWorkouts);
        });
        weekWorkoutsMap.set(week.id, allWorkouts);
      });

      // Build final structure
      const result: PlanWithWeeks[] = plans.map((plan) => {
        const planWeeks = weeks?.filter((w) => w.program_plan_id === plan.id) || [];
        return {
          ...plan,
          weeks: planWeeks.map((week) => ({
            ...week,
            days: daysMap.get(week.id) || [],
            workouts: weekWorkoutsMap.get(week.id) || [],
          })),
        };
      });

      return result;
    },
    enabled: !!user,
  });

  // Filter programs based on tab and search
  const filteredPrograms = useMemo(() => {
    let programs = allPrograms;

    // Filter by tab
    if (activeTab === "templates") {
      programs = programs.filter((p) => p.is_template);
    } else {
      programs = programs.filter((p) => !p.is_template);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      programs = programs.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.weeks.some(
            (w) =>
              w.name?.toLowerCase().includes(query) ||
              w.workouts.some((wo) => wo.name.toLowerCase().includes(query)),
          ),
      );
    }

    return programs;
  }, [allPrograms, activeTab, searchQuery]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with Search and Tabs */}
      <div className="p-4 space-y-3 border-b border-border/50">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca programma..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "programs" | "templates")}>
          <TabsList className="w-full h-9">
            <TabsTrigger value="programs" className="flex-1 text-xs gap-1.5">
              <Layout className="h-3.5 w-3.5" />
              Programmi
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1 text-xs gap-1.5">
              <FileStack className="h-3.5 w-3.5" />
              Template
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Programs List */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {filteredPrograms.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {searchQuery
                  ? "Nessun risultato"
                  : activeTab === "templates"
                    ? "Nessun template"
                    : "Nessun programma"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery ? "Prova con altri termini" : "Crea un programma nel Program Builder"}
              </p>
            </div>
          ) : (
            <Accordion
              type="multiple"
              value={expandedPlans}
              onValueChange={setExpandedPlans}
              className="space-y-2"
            >
              {filteredPrograms.map((plan) => (
                <AccordionItem
                  key={plan.id}
                  value={plan.id}
                  className="border rounded-xl bg-card overflow-hidden shadow-sm"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                    <div className="flex items-center gap-3 text-left">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{plan.name}</p>
                        <p className="text-2xs text-muted-foreground">
                          {plan.weeks.length} settimane •{""}
                          {plan.weeks.reduce((acc, w) => acc + w.workouts.length, 0)}
                          {""}
                          workout
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <Accordion
                      type="multiple"
                      value={expandedWeeks}
                      onValueChange={setExpandedWeeks}
                      className="space-y-2"
                    >
                      {plan.weeks.map((week) => (
                        <AccordionItem key={week.id} value={week.id} className="border-0">
                          {/* Draggable Week Header */}
                          <div className="flex items-center gap-1">
                            <div className="flex-1">
                              <DraggableWeek
                                week={week}
                                planId={plan.id}
                                workoutCount={week.workouts.length}
                              />
                            </div>
                            <AccordionTrigger className="p-2 hover:no-underline hover:bg-muted/50 rounded-lg [&>svg]:hidden">
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                            </AccordionTrigger>
                          </div>
                          <AccordionContent className="pt-2 pl-2 space-y-2">
                            {week.workouts.length === 0 ? (
                              <p className="text-xs text-muted-foreground px-3 py-2 italic">
                                Nessun workout in questa settimana
                              </p>
                            ) : (
                              week.workouts.map((workout) => (
                                <DraggableWorkout
                                  key={workout.id}
                                  workout={workout}
                                  weekId={week.id}
                                  planId={plan.id}
                                />
                              ))
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </ScrollArea>

      {/* Footer Hint */}
      <div className="p-3 border-t border-border/50 bg-muted/30">
        <p className="text-2xs text-muted-foreground text-center">
          Trascina workout o settimane sul calendario per programmarli
        </p>
      </div>
    </div>
  );
}
