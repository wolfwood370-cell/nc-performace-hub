import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Phone,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  isToday,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from "date-fns";
import { it } from "date-fns/locale";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export interface ScheduledWorkoutLog {
  id: string;
  status: "scheduled" | "completed" | "missed";
  scheduled_date: string;
  scheduled_start_time: string | null;
  workout_name: string;
  athlete_id: string;
  athlete_name: string;
  avatar_url: string | null;
  program_workout_id: string | null;
}

export interface CalendarAppointment {
  id: string;
  title: string;
  type: "check-in" | "pt-session" | "other";
  date: string;
  time: string;
}

export interface GoogleBusySlot {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface CalendarGridProps {
  workoutLogs: ScheduledWorkoutLog[];
  appointments?: CalendarAppointment[];
  googleBusySlots?: GoogleBusySlot[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  view: "month" | "week";
  onViewChange: (view: "month" | "week") => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  showGoogleEvents: boolean;
  onToggleGoogleEvents: (show: boolean) => void;
  onDeleteWorkout?: (logId: string) => void;
}

// Droppable Day Cell for Month View
function DroppableDayCell({
  date,
  isSelected,
  isCurrentMonth,
  isTodayDate,
  workouts,
  appointments,
  busySlots,
  showGoogleEvents,
  onClick,
  onDeleteWorkout,
}: {
  date: Date;
  isSelected: boolean;
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  workouts: ScheduledWorkoutLog[];
  appointments: CalendarAppointment[];
  busySlots: GoogleBusySlot[];
  showGoogleEvents: boolean;
  onClick: () => void;
  onDeleteWorkout?: (logId: string) => void;
}) {
  const dateKey = format(date, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({
    id: `calendar-day-${dateKey}`,
    data: { type: "calendar-day", date, dateKey },
  });

  const totalEvents =
    workouts.length + appointments.length + (showGoogleEvents ? busySlots.length : 0);

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "min-h-[100px] p-2 rounded-xl transition-all relative flex flex-col text-left",
        "hover:bg-muted/50 border border-transparent",
        !isCurrentMonth && "opacity-40",
        isSelected && "ring-2 ring-primary bg-primary/5 border-primary/20",
        isTodayDate && !isSelected && "bg-accent/50 border-accent",
        isOver && "ring-2 ring-primary bg-primary/10 scale-[1.02] border-primary",
      )}
    >
      {/* Day Number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-semibold",
            isTodayDate &&
              "bg-primary text-primary-foreground h-6 w-6 rounded-full flex items-center justify-center",
          )}
        >
          {format(date, "d")}
        </span>
        {totalEvents > 0 && (
          <Badge variant="secondary" className="text-3xs h-4 px-1.5">
            {totalEvents}
          </Badge>
        )}
      </div>

      {/* Events */}
      <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
        {/* Workouts - Blue */}
        {workouts.slice(0, 2).map((workout) => (
          <div
            key={workout.id}
            className={cn(
              "text-3xs px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1 group/event relative",
              workout.status === "scheduled" && "bg-primary/15 text-primary",
              workout.status === "completed" && "bg-success/15 text-success",
              workout.status === "missed" && "bg-destructive/15 text-destructive",
            )}
          >
            {workout.status === "scheduled" && <Clock className="h-2.5 w-2.5 shrink-0" />}
            {workout.status === "completed" && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
            {workout.status === "missed" && <XCircle className="h-2.5 w-2.5 shrink-0" />}
            <span className="truncate flex-1">{workout.workout_name}</span>
            {workout.status === "scheduled" && onDeleteWorkout && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteWorkout(workout.id);
                }}
                className="h-4 w-4 rounded-full bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center opacity-0 group-hover/event:opacity-100 transition-opacity shrink-0"
                title="Rimuovi"
              >
                <X className="h-2.5 w-2.5 text-destructive" />
              </button>
            )}
          </div>
        ))}

        {/* Appointments - Green */}
        {appointments.slice(0, 1).map((apt) => (
          <div
            key={apt.id}
            className="text-3xs px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          >
            {apt.type === "check-in" && <Phone className="h-2.5 w-2.5 shrink-0" />}
            {apt.type === "pt-session" && <Video className="h-2.5 w-2.5 shrink-0" />}
            <span className="truncate">{apt.title}</span>
          </div>
        ))}

        {/* Google Busy Slots - Gray */}
        {showGoogleEvents &&
          busySlots.slice(0, 1).map((slot) => (
            <div
              key={slot.id}
              className="text-3xs px-1.5 py-0.5 rounded truncate font-medium bg-muted text-muted-foreground"
            >
              {slot.title || "Busy"}
            </div>
          ))}

        {/* Overflow indicator */}
        {totalEvents > 3 && (
          <span className="text-3xs text-muted-foreground px-1">+{totalEvents - 3} altri</span>
        )}
      </div>
    </button>
  );
}

// Week View Row
function WeekViewRow({
  date,
  workouts,
  appointments,
  busySlots,
  showGoogleEvents,
  isSelected,
  onClick,
  onDeleteWorkout,
}: {
  date: Date;
  workouts: ScheduledWorkoutLog[];
  appointments: CalendarAppointment[];
  busySlots: GoogleBusySlot[];
  showGoogleEvents: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDeleteWorkout?: (logId: string) => void;
}) {
  const dateKey = format(date, "yyyy-MM-dd");
  const { isOver, setNodeRef } = useDroppable({
    id: `calendar-day-${dateKey}`,
    data: { type: "calendar-day", date, dateKey },
  });

  const isTodayDate = isToday(date);

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "flex items-stretch border-b border-border/30 min-h-[120px] cursor-pointer hover:bg-muted/20 transition-colors",
        isSelected && "bg-primary/5",
        isOver && "bg-primary/10",
      )}
    >
      {/* Day label */}
      <div
        className={cn(
          "w-24 shrink-0 p-3 border-r border-border/30 flex flex-col items-center justify-center",
          isTodayDate && "bg-accent/30",
        )}
      >
        <span className="text-xs uppercase text-muted-foreground font-medium">
          {format(date, "EEE", { locale: it })}
        </span>
        <span
          className={cn("text-2xl font-bold tabular-nums mt-0.5", isTodayDate && "text-primary")}
        >
          {format(date, "d")}
        </span>
        <span className="text-3xs text-muted-foreground">
          {format(date, "MMM", { locale: it })}
        </span>
      </div>

      {/* Events */}
      <div className="flex-1 p-3 space-y-2">
        {workouts.length === 0 &&
        appointments.length === 0 &&
        (!showGoogleEvents || busySlots.length === 0) ? (
          <p className="text-sm text-muted-foreground/60 italic">
            Trascina qui un workout per programmarlo
          </p>
        ) : (
          <>
            {/* Workouts */}
            {workouts.map((workout) => (
              <div
                key={workout.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg group relative",
                  workout.status === "scheduled" && "bg-primary/10 border border-primary/20",
                  workout.status === "completed" && "bg-success/10 border border-success/20",
                  workout.status === "missed" && "bg-destructive/10 border border-destructive/20",
                )}
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                    workout.status === "scheduled" && "bg-primary/20",
                    workout.status === "completed" && "bg-success/20",
                    workout.status === "missed" && "bg-destructive/20",
                  )}
                >
                  {workout.status === "scheduled" && <Clock className="h-4 w-4 text-primary" />}
                  {workout.status === "completed" && (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                  {workout.status === "missed" && <XCircle className="h-4 w-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{workout.workout_name}</p>
                  <p className="text-2xs text-muted-foreground">
                    {workout.scheduled_start_time?.slice(0, 5) || "Orario libero"}
                  </p>
                </div>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={workout.avatar_url || undefined} />
                  <AvatarFallback className="text-5xs">
                    {workout.athlete_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                {/* Delete button */}
                {workout.status === "scheduled" && onDeleteWorkout && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteWorkout(workout.id);
                    }}
                    className="h-6 w-6 rounded-full bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Rimuovi dal calendario"
                  >
                    <X className="h-3.5 w-3.5 text-destructive" />
                  </button>
                )}
              </div>
            ))}

            {/* Appointments */}
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
              >
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  {apt.type === "check-in" && <Phone className="h-4 w-4 text-emerald-500" />}
                  {apt.type === "pt-session" && <Video className="h-4 w-4 text-emerald-500" />}
                  {apt.type === "other" && <CalendarDays className="h-4 w-4 text-emerald-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-emerald-700 dark:text-emerald-400">
                    {apt.title}
                  </p>
                  <p className="text-2xs text-muted-foreground">{apt.time}</p>
                </div>
              </div>
            ))}

            {/* Google Busy Slots */}
            {showGoogleEvents &&
              busySlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted border border-border/50"
                >
                  <div className="h-8 w-8 rounded-lg bg-muted-foreground/10 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-muted-foreground">
                      {slot.title || "Occupato"}
                    </p>
                    <p className="text-2xs text-muted-foreground">
                      {slot.startTime} - {slot.endTime}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-3xs">
                    Google
                  </Badge>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

export function CalendarGrid({
  workoutLogs,
  appointments = [],
  googleBusySlots = [],
  onDateSelect,
  selectedDate,
  view,
  onViewChange,
  currentDate,
  onDateChange,
  showGoogleEvents,
  onToggleGoogleEvents,
  onDeleteWorkout,
}: CalendarGridProps) {
  // Group workouts by date
  const workoutsByDate = useMemo(() => {
    const grouped: Record<string, ScheduledWorkoutLog[]> = {};
    workoutLogs.forEach((log) => {
      const dateKey = log.scheduled_date;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(log);
    });
    return grouped;
  }, [workoutLogs]);

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const grouped: Record<string, CalendarAppointment[]> = {};
    appointments.forEach((apt) => {
      if (!grouped[apt.date]) grouped[apt.date] = [];
      grouped[apt.date].push(apt);
    });
    return grouped;
  }, [appointments]);

  // Group busy slots by date
  const busySlotsByDate = useMemo(() => {
    const grouped: Record<string, GoogleBusySlot[]> = {};
    googleBusySlots.forEach((slot) => {
      if (!grouped[slot.date]) grouped[slot.date] = [];
      grouped[slot.date].push(slot);
    });
    return grouped;
  }, [googleBusySlots]);

  // Get days based on view
  const days = useMemo(() => {
    if (view === "month") {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const monthDays = eachDayOfInterval({ start, end });

      // Pad to Monday start
      let startDay = getDay(start);
      startDay = startDay === 0 ? 6 : startDay - 1;
      const paddingDays: (Date | null)[] = Array(startDay).fill(null);

      return [...paddingDays, ...monthDays];
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, view]);

  const handlePrev = () => {
    if (view === "month") {
      onDateChange(subMonths(currentDate, 1));
    } else {
      onDateChange(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (view === "month") {
      onDateChange(addMonths(currentDate, 1));
    } else {
      onDateChange(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    onDateChange(new Date());
    onDateSelect(new Date());
  };

  // Title based on view
  const title = useMemo(() => {
    if (view === "month") {
      return format(currentDate, "MMMM yyyy", { locale: it });
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "d MMM", { locale: it })} - ${format(end, "d MMM yyyy", { locale: it })}`;
    }
  }, [currentDate, view]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-bold capitalize min-w-[220px] text-center">{title}</h2>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} className="ml-2">
            Oggi
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {/* Google Calendar Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={showGoogleEvents}
              onCheckedChange={onToggleGoogleEvents}
              id="google-events"
            />
            <label htmlFor="google-events" className="text-sm text-muted-foreground cursor-pointer">
              Mostra Google Calendar
            </label>
          </div>

          {/* View Toggle */}
          <Tabs value={view} onValueChange={(v) => onViewChange(v as "month" | "week")}>
            <TabsList className="h-9">
              <TabsTrigger value="month" className="text-xs px-4">
                Mese
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-4">
                Settimana
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-hidden pt-4">
        {view === "month" && (
          <>
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wide"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-7 gap-2 auto-rows-fr">
              {days.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="min-h-[100px]" />;
                }

                const dateKey = format(day, "yyyy-MM-dd");
                const dayWorkouts = workoutsByDate[dateKey] || [];
                const dayAppointments = appointmentsByDate[dateKey] || [];
                const dayBusySlots = busySlotsByDate[dateKey] || [];

                return (
                  <DroppableDayCell
                    key={dateKey}
                    date={day}
                    isSelected={isSameDay(day, selectedDate)}
                    isCurrentMonth={isSameMonth(day, currentDate)}
                    isTodayDate={isToday(day)}
                    workouts={dayWorkouts}
                    appointments={dayAppointments}
                    busySlots={dayBusySlots}
                    showGoogleEvents={showGoogleEvents}
                    onClick={() => onDateSelect(day)}
                    onDeleteWorkout={onDeleteWorkout}
                  />
                );
              })}
            </div>
          </>
        )}

        {view === "week" && (
          <ScrollArea className="h-full">
            <div className="border border-border/30 rounded-xl overflow-hidden">
              {(days as Date[]).map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayWorkouts = workoutsByDate[dateKey] || [];
                const dayAppointments = appointmentsByDate[dateKey] || [];
                const dayBusySlots = busySlotsByDate[dateKey] || [];

                return (
                  <WeekViewRow
                    key={dateKey}
                    date={day}
                    workouts={dayWorkouts}
                    appointments={dayAppointments}
                    busySlots={dayBusySlots}
                    showGoogleEvents={showGoogleEvents}
                    isSelected={isSameDay(day, selectedDate)}
                    onClick={() => onDateSelect(day)}
                    onDeleteWorkout={onDeleteWorkout}
                  />
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 pt-3 border-t border-border/50 text-2xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>Appointments</span>
        </div>
        {showGoogleEvents && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/60" />
            <span>Google Busy</span>
          </div>
        )}
      </div>
    </div>
  );
}
