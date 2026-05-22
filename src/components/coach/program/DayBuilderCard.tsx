/**
 * src/components/coach/program/DayBuilderCard.tsx
 * ---------------------------------------------------------------------------
 * Aura Health System — Day column inside the ProgramBuilder week grid.
 *
 * Spec (DESIGN.md + Stitch reference):
 *   1. Day Column with volume calculator embedded in the header
 *      (total sets + estimated rep volume).
 *   2. Exercises segmented into 3 micro-phases by name heuristic:
 *      - Activation & Potentiation (warm-up, mobility, plyometrics)
 *      - Main Compound Lifts (squat / bench / deadlift / press / row /
 *        Olympic patterns)
 *      - Hypertrophic Drivers (accessory + isolation work; default)
 *   3. Empty drop-zone uses the premium dashed template canvas
 *      (`border-2 border-dashed border-outline-variant
 *      bg-surface-container-low/30 rounded-[24px] h-64 p-6`) with a
 *      centered interactive Plus icon.
 *
 * Store reactivity preserved 1:1:
 *   - useSortable / SortableContext / useDroppable from dnd-kit
 *   - onRemoveExercise / onToggleSuperset / onSelectExercise /
 *     onAddSlot / onCopyDay / onSaveAsTemplate (all parent-injected)
 *   - SortableExercise + EmptySlot internals unchanged
 */
import React, { memo, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Trash2,
  Link2,
  Unlink,
  Copy,
  Plus,
  Bookmark,
  TrendingUp,
  Zap,
  Dumbbell,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramExercise } from "@/components/coach/WeekGrid";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
// Coach-facing letter labels (Day A / Day B / Day C / …) — match the
// Stitch reference where columns are tagged by training split letter.
const DAY_LETTERS = ["A", "B", "C", "D", "E", "F", "G"];

// ---------------------------------------------------------------------------
// Micro-phase categorization
// ---------------------------------------------------------------------------

type MicroPhase = "activation" | "main" | "hypertrophy";

interface PhaseConfig {
  key: MicroPhase;
  label: string;
  description: string;
  icon: typeof Zap;
  accent: string; // text color
  ring: string; // left accent strip
  tint: string; // soft background tint
}

const PHASES: Record<MicroPhase, PhaseConfig> = {
  activation: {
    key: "activation",
    label: "Activation & Potentiation",
    description: "Warm-up · mobilità · attivazione",
    icon: Zap,
    accent: "text-amber-600 dark:text-amber-400",
    ring: "before:bg-amber-500",
    tint: "bg-amber-500/5",
  },
  main: {
    key: "main",
    label: "Main Compound Lifts",
    description: "Squat · Panca · Stacco · Press · Trazione",
    icon: Dumbbell,
    accent: "text-primary",
    ring: "before:bg-primary",
    tint: "bg-primary-container/10",
  },
  hypertrophy: {
    key: "hypertrophy",
    label: "Hypertrophic Drivers",
    description: "Accessory · isolation · finisher",
    icon: Flame,
    accent: "text-tertiary-container",
    ring: "before:bg-tertiary-container",
    tint: "bg-tertiary-container/5",
  },
};

const ACTIVATION_RE =
  /attivazione|attivat|warm|riscaldam|mobilit|plio|jump|salto|crunch|core|band|elastico|stretch|breath|respir/i;
const MAIN_LIFT_RE =
  /squat|panca|bench|stacco|deadlift|\bpress\b|press\s*militar|military\s*press|overhead|\bohp\b|trazion|pull[\s-]?up|chin[\s-]?up|pulldown|rematore|\brow\b|clean|snatch|jerk|push\s*press|front\s*squat|back\s*squat/i;

function categorize(name: string): MicroPhase {
  if (ACTIVATION_RE.test(name)) return "activation";
  if (MAIN_LIFT_RE.test(name)) return "main";
  return "hypertrophy";
}

// ---------------------------------------------------------------------------
// Volume calculator helpers
// ---------------------------------------------------------------------------

/** Extract the first integer from a reps string like "8", "8-10", "AMRAP", "12x". */
function parseRepsNumber(reps: number | string | undefined): number {
  if (typeof reps === "number" && Number.isFinite(reps)) return reps;
  if (typeof reps === "string") {
    const m = reps.match(/\d+/);
    if (m) return Number(m[0]);
  }
  return 0;
}

/** Aggregate sets and rep-volume across filled exercises in a day. */
function computeDayVolume(exercises: ProgramExercise[]): {
  totalSets: number;
  totalRepVolume: number;
} {
  let totalSets = 0;
  let totalRepVolume = 0;
  for (const ex of exercises) {
    if (ex.isEmpty) continue;
    const sets = typeof ex.sets === "number" ? ex.sets : 0;
    const reps = parseRepsNumber(ex.reps);
    totalSets += sets;
    totalRepVolume += sets * reps;
  }
  return { totalSets, totalRepVolume };
}

// ---------------------------------------------------------------------------
// EmptySlot — small inline drop placeholder (used between filled rows)
// ---------------------------------------------------------------------------
function EmptySlot({
  slotId,
  dayIndex,
  weekIndex,
  onRemove,
}: {
  slotId: string;
  dayIndex: number;
  weekIndex: number;
  onRemove: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
    data: { type: "empty-slot", weekIndex, dayIndex, slotId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-3 text-center transition-all group min-h-[48px] flex items-center justify-center",
        isOver
          ? "border-primary bg-primary-container/10 scale-[1.02]"
          : "border-outline-variant/50 bg-surface-container-low/30 hover:border-primary/40",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Rimuovi slot"
        className="absolute top-1 right-1 h-5 w-5 rounded-full text-on-surface-variant opacity-0 group-hover:opacity-100"
        onClick={onRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
      <p className="text-3xs font-bold text-on-surface-variant uppercase tracking-wider">
        Trascina esercizio qui
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableExercise — compact row card with drag handle
// ---------------------------------------------------------------------------
function SortableExercise({
  exercise,
  dayIndex,
  weekIndex,
  isSelected,
  onRemove,
  onToggleSuperset,
  onSelect,
  isInSuperset,
  supersetColor,
}: {
  exercise: ProgramExercise;
  dayIndex: number;
  weekIndex: number;
  isSelected?: boolean;
  onRemove: () => void;
  onToggleSuperset: () => void;
  onSelect?: () => void;
  isInSuperset: boolean;
  supersetColor?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: exercise.id,
    data: { type: "program-exercise", exercise, dayIndex, weekIndex },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const setsReps = exercise.sets ? `${exercise.sets}×${exercise.reps || "?"}` : null;
  const rpeText = exercise.rpe ? `RPE ${exercise.rpe}` : null;
  const hasProgression = exercise.progression?.enabled && exercise.progression.rules.length > 0;

  const handleSelect = () => onSelect?.();
  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      style={style}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, [data-drag-handle]")) return;
        handleSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if ((e.target as HTMLElement).closest("button, [data-drag-handle]")) return;
          e.preventDefault();
          handleSelect();
        }
      }}
      className={cn(
        "bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary z-50",
        isSelected && "ring-2 ring-primary border-primary",
        isInSuperset && "border-l-4",
        supersetColor,
        !isDragging && "hover:shadow-md hover:border-outline-variant/40",
      )}
    >
      <div className="flex items-stretch">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          data-drag-handle
          aria-label="Trascina esercizio"
          className={cn(
            "flex items-center justify-center px-2 rounded-l-2xl border-r border-outline-variant/20",
            "bg-surface-container-low hover:bg-surface-container cursor-grab active:cursor-grabbing",
            "touch-none select-none flex-shrink-0",
          )}
        >
          <div className="flex flex-col gap-[2px]">
            <div className="flex gap-[2px]">
              <span className="w-[3px] h-[3px] rounded-full bg-on-surface-variant/50" />
              <span className="w-[3px] h-[3px] rounded-full bg-on-surface-variant/50" />
            </div>
            <div className="flex gap-[2px]">
              <span className="w-[3px] h-[3px] rounded-full bg-on-surface-variant/50" />
              <span className="w-[3px] h-[3px] rounded-full bg-on-surface-variant/50" />
            </div>
            <div className="flex gap-[2px]">
              <span className="w-[3px] h-[3px] rounded-full bg-on-surface-variant/50" />
              <span className="w-[3px] h-[3px] rounded-full bg-on-surface-variant/50" />
            </div>
          </div>
        </button>

        <div className="flex-1 p-2.5 min-w-0 group cursor-pointer">
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p
                  className="text-xs font-bold text-on-surface truncate leading-tight"
                  title={exercise.name}
                >
                  {exercise.name}
                </p>
                {hasProgression && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-shrink-0 h-4 w-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <TrendingUp className="h-2.5 w-2.5 text-emerald-600" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Progressione attiva
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {setsReps && (
                  <span className="text-3xs font-bold text-on-surface tabular-nums">
                    {setsReps}
                  </span>
                )}
                {rpeText && (
                  <span className="text-3xs font-bold text-primary bg-primary-container/15 px-1.5 py-0.5 rounded-full">
                    {rpeText}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={isInSuperset ? "Rimuovi dal superset" : "Collega in superset"}
                    className={cn(
                      "h-6 w-6 rounded-full flex-shrink-0",
                      isInSuperset && "text-primary opacity-100",
                    )}
                    onClick={onToggleSuperset}
                  >
                    {isInSuperset ? <Unlink className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isInSuperset ? "Rimuovi dal superset" : "Collega in superset"}
                </TooltipContent>
              </Tooltip>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Rimuovi esercizio"
                className="h-6 w-6 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                onClick={onRemove}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PhaseSection — header + sorted rows inside a single micro-phase group
// ---------------------------------------------------------------------------
function PhaseSection({
  phase,
  exercises,
  dayIndex,
  weekIndex,
  selectedExerciseId,
  onRemove,
  onToggleSuperset,
  onSelect,
  supersetColors,
}: {
  phase: MicroPhase;
  exercises: ProgramExercise[];
  dayIndex: number;
  weekIndex: number;
  selectedExerciseId?: string | null;
  onRemove: (id: string) => void;
  onToggleSuperset: (id: string) => void;
  onSelect?: (ex: ProgramExercise) => void;
  supersetColors: Record<string, string>;
}) {
  if (exercises.length === 0) return null;
  const cfg = PHASES[phase];
  const Icon = cfg.icon;

  return (
    <section aria-label={cfg.label} className={cn("relative rounded-2xl p-2.5 pl-3.5", cfg.tint)}>
      {/* Left accent strip */}
      <div
        className={cn(
          "absolute left-2 top-3 bottom-3 w-1 rounded-full",
          cfg.ring.replace("before:", ""),
        )}
        aria-hidden
      />
      <header className="flex items-center justify-between gap-2 mb-2 pl-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn("h-3 w-3 flex-shrink-0", cfg.accent)} />
          <p className={cn("text-3xs font-bold uppercase tracking-wider truncate", cfg.accent)}>
            {cfg.label}
          </p>
        </div>
        <span className="text-3xs font-bold text-on-surface-variant tabular-nums flex-shrink-0">
          {exercises.length}
        </span>
      </header>
      <div className="space-y-1.5">
        {exercises.map((exercise) =>
          exercise.isEmpty ? (
            <EmptySlot
              key={exercise.id}
              slotId={exercise.id}
              dayIndex={dayIndex}
              weekIndex={weekIndex}
              onRemove={() => onRemove(exercise.id)}
            />
          ) : (
            <SortableExercise
              key={exercise.id}
              exercise={exercise}
              dayIndex={dayIndex}
              weekIndex={weekIndex}
              isSelected={selectedExerciseId === exercise.id}
              onRemove={() => onRemove(exercise.id)}
              onToggleSuperset={() => onToggleSuperset(exercise.id)}
              onSelect={() => onSelect?.(exercise)}
              isInSuperset={!!exercise.supersetGroup}
              supersetColor={
                exercise.supersetGroup ? supersetColors[exercise.supersetGroup] : undefined
              }
            />
          ),
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// DayBuilderCard — memoized day column
// ---------------------------------------------------------------------------
export interface DayBuilderCardProps {
  dayIndex: number;
  weekIndex: number;
  exercises: ProgramExercise[];
  selectedExerciseId?: string | null;
  onRemoveExercise: (exerciseId: string) => void;
  onToggleSuperset: (exerciseId: string) => void;
  onSelectExercise?: (exercise: ProgramExercise) => void;
  onAddSlot: () => void;
  onCopyDay: () => void;
  onSaveAsTemplate: () => void;
}

export const DayBuilderCard = memo(function DayBuilderCard({
  dayIndex,
  weekIndex,
  exercises,
  selectedExerciseId,
  onRemoveExercise,
  onToggleSuperset,
  onSelectExercise,
  onAddSlot,
  onCopyDay,
  onSaveAsTemplate,
}: DayBuilderCardProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${weekIndex}-${dayIndex}`,
    data: { type: "day-cell", weekIndex, dayIndex },
  });

  // Group filled exercises by micro-phase (computed in a stable order)
  const filledExercises = useMemo(() => exercises.filter((e) => !e.isEmpty), [exercises]);
  const emptySlots = useMemo(() => exercises.filter((e) => e.isEmpty), [exercises]);

  const phaseBuckets = useMemo(() => {
    const buckets: Record<MicroPhase, ProgramExercise[]> = {
      activation: [],
      main: [],
      hypertrophy: [],
    };
    for (const ex of filledExercises) {
      buckets[categorize(ex.name)].push(ex);
    }
    return buckets;
  }, [filledExercises]);

  // Superset color assignment (stable across renders)
  const supersetColors = useMemo(() => {
    const groups = [
      ...new Set(
        exercises.filter((e) => e.supersetGroup && !e.isEmpty).map((e) => e.supersetGroup),
      ),
    ];
    const colors = ["border-l-primary", "border-l-success", "border-l-warning", "border-l-accent"];
    const map: Record<string, string> = {};
    groups.forEach((group, i) => {
      if (group) map[group] = colors[i % colors.length];
    });
    return map;
  }, [exercises]);

  // Volume calculator (header)
  const { totalSets, totalRepVolume } = useMemo(
    () => computeDayVolume(filledExercises),
    [filledExercises],
  );

  // ── Empty state: full premium dashed drop-zone (Aura) ──────────────────
  if (exercises.length === 0) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "border-2 border-dashed rounded-[24px] h-64 p-6 transition-all",
          "bg-surface-container-low/30 flex flex-col items-center justify-center text-center",
          isOver
            ? "border-primary bg-primary-container/10 scale-[1.02]"
            : "border-outline-variant hover:border-primary/50 hover:bg-primary-container/5",
        )}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container/15 mb-3">
          <span className="font-display text-xl font-bold text-primary">
            {DAY_LETTERS[dayIndex] ?? "?"}
          </span>
        </div>
        <p className="text-label-md font-bold text-on-surface mb-1">
          Day {DAY_LETTERS[dayIndex] ?? "?"} · {DAYS[dayIndex]}
        </p>
        <p className="text-xs text-on-surface-variant max-w-[200px] mb-4">
          Trascina un esercizio o aggiungi uno slot per iniziare a programmare questo giorno.
        </p>
        <Button variant="outline" size="sm" onClick={onAddSlot} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Aggiungi Slot
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-[200px] rounded-3xl border bg-surface-container-lowest shadow-sm transition-all",
        isOver ? "ring-2 ring-primary border-primary" : "border-outline-variant/20 hover:shadow-md",
      )}
    >
      {/* ─── Day Header — volume calculator + tools ─── */}
      <header className="px-3 py-2.5 border-b border-outline-variant/15 bg-surface-container-low/40 rounded-t-3xl group">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-container/15 flex-shrink-0">
              <span className="font-display text-xs font-bold text-primary">
                {DAY_LETTERS[dayIndex] ?? "?"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface leading-tight">
                Day {DAY_LETTERS[dayIndex] ?? "?"}
              </p>
              <p className="text-3xs text-on-surface-variant uppercase tracking-wider">
                {DAYS[dayIndex]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Salva come template"
                  className="h-6 w-6 rounded-full"
                  onClick={onSaveAsTemplate}
                >
                  <Bookmark className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Salva come template</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copia allenamento"
                  className="h-6 w-6 rounded-full"
                  onClick={onCopyDay}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copia allenamento</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Volume calculator row */}
        <div className="flex items-center gap-2 text-3xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest border border-outline-variant/30 px-2 py-0.5 font-bold text-on-surface tabular-nums">
            <Dumbbell className="h-2.5 w-2.5 text-on-surface-variant" />
            {filledExercises.length} ex
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest border border-outline-variant/30 px-2 py-0.5 font-bold text-on-surface tabular-nums">
            <Flame className="h-2.5 w-2.5 text-primary" />
            {totalSets} set
          </span>
          {totalRepVolume > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/15 px-2 py-0.5 font-bold text-primary tabular-nums">
                  {totalRepVolume}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Volume in ripetizioni totali (sets × reps)
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>

      {/* ─── Body — micro-phase segmented sections ─── */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        <SortableContext items={exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <PhaseSection
            phase="activation"
            exercises={phaseBuckets.activation}
            dayIndex={dayIndex}
            weekIndex={weekIndex}
            selectedExerciseId={selectedExerciseId}
            onRemove={onRemoveExercise}
            onToggleSuperset={onToggleSuperset}
            onSelect={onSelectExercise}
            supersetColors={supersetColors}
          />
          <PhaseSection
            phase="main"
            exercises={phaseBuckets.main}
            dayIndex={dayIndex}
            weekIndex={weekIndex}
            selectedExerciseId={selectedExerciseId}
            onRemove={onRemoveExercise}
            onToggleSuperset={onToggleSuperset}
            onSelect={onSelectExercise}
            supersetColors={supersetColors}
          />
          <PhaseSection
            phase="hypertrophy"
            exercises={phaseBuckets.hypertrophy}
            dayIndex={dayIndex}
            weekIndex={weekIndex}
            selectedExerciseId={selectedExerciseId}
            onRemove={onRemoveExercise}
            onToggleSuperset={onToggleSuperset}
            onSelect={onSelectExercise}
            supersetColors={supersetColors}
          />

          {/* Trailing empty slots (drop placeholders awaiting fill) */}
          {emptySlots.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {emptySlots.map((slot) => (
                <EmptySlot
                  key={slot.id}
                  slotId={slot.id}
                  dayIndex={dayIndex}
                  weekIndex={weekIndex}
                  onRemove={() => onRemoveExercise(slot.id)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>

      {/* ─── Add Slot Button (pill) ─── */}
      <div className="p-2 pt-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 border-dashed border-outline-variant/50 hover:border-primary/40 text-on-surface-variant hover:text-on-surface"
          onClick={onAddSlot}
        >
          <Plus className="h-3.5 w-3.5" />
          Aggiungi Slot
        </Button>
      </div>
    </div>
  );
});
