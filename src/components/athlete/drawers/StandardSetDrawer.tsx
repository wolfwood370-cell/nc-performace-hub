// =============================================================================
// src/components/athlete/drawers/StandardSetDrawer.tsx
// =============================================================================
// Standard sets execution drawer, wired to the Supabase data layer.
//
// UI model:
//   - Header: title + close.
//   - Coach's protocol card.
//   - "Completed sets" list — reads `exercise_logs` filtered to this
//     exercise via React Query. Empty when nothing has been logged yet.
//   - Active input row — bound to local `weight` + `reps` state. Tapping
//     "Aggiungi Set" fires `useLogSetMutation` with the next
//     `set_number`, clears the inputs, and refocuses the kg field.
//   - Sticky footer: "Termina Esercizio" → closes the drawer.
//
// Inputs use `type="number" inputMode="decimal"` per the project's
// established mobile-keyboard convention. Empty / NaN inputs land as 0
// in the row — honest about what the user actually typed.
// =============================================================================

import { useRef, useState } from "react";
import { Check, Megaphone, Plus, Play, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DrawerShell } from "./DrawerShell";
import { useAthleteWorkoutStore } from "@/stores/useAthleteWorkoutStore";
import {
  useLogSetMutation,
  useSessionSetsQuery,
  type ExerciseLogRow,
} from "@/hooks/athlete/useAthleteWorkoutHooks";

// Module-scope stable empty array — used as a fallback when the query
// has no data yet, so the rendered set list reference stays stable
// across renders.
const EMPTY_SETS: ExerciseLogRow[] = [];

interface StandardSetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Unique identifier of the exercise being logged. Required so each
   * commit lands on the right `exercise_logs` row.
   */
  exerciseId: string;
  /** Optional override title — defaults to the mock "A1. Barbell Back Squat". */
  exerciseName?: string;
  meta?: string;
  /** Coach's previous best — surfaced above the input as a reference. */
  previousReference?: string;
  /** Rest period between sets, in seconds. Drives the timer button. */
  restSeconds?: number;
}

export function StandardSetDrawer({
  isOpen,
  onClose,
  exerciseId,
  exerciseName = "A1. Barbell Back Squat",
  meta = "Forza Primaria · RPE 8",
  previousReference = "100kg × 8",
  restSeconds = 90,
}: StandardSetDrawerProps) {
  // -- Local input state --------------------------------------------------
  // Strings (not numbers) so an empty field renders as "" rather than 0.
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  // Ref on the weight input so we can re-focus it after a successful
  // logSet — keeps the keyboard up and the cursor in the same place
  // for rapid back-to-back set logging.
  const weightInputRef = useRef<HTMLInputElement | null>(null);

  // -- Data layer wiring --------------------------------------------------
  // The session id is local UI state (which DB row is being edited).
  // Reads are scoped to that session and filtered down to this exercise.
  const activeSessionId = useAthleteWorkoutStore((s) => s.activeSessionId);
  const sessionSets = useSessionSetsQuery(activeSessionId);
  const completedSets = sessionSets.data
    ? sessionSets.data.filter((row) => row.exercise_id === exerciseId)
    : EMPTY_SETS;

  const logSetMutation = useLogSetMutation();

  // Disabled until at least one of the fields is populated. We don't
  // require both — coaches sometimes log "BW × N" (bodyweight) which
  // is weight=0, reps=N. Same for "single rep max" tests where reps=1
  // is intentional. Also disabled while another set is mid-flight to
  // avoid duplicate inserts on rapid taps.
  const canLog =
    (weight.trim().length > 0 || reps.trim().length > 0) &&
    !logSetMutation.isPending &&
    activeSessionId !== null;

  const handleLogSet = () => {
    if (!canLog || !activeSessionId) return;
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    logSetMutation.mutate(
      {
        session_id: activeSessionId,
        exercise_id: exerciseId,
        set_number: completedSets.length + 1,
        weight: w,
        reps: r,
      },
      {
        onSuccess: () => {
          setWeight("");
          setReps("");
          weightInputRef.current?.focus();
        },
      },
    );
  };

  return (
    <DrawerShell open={isOpen} onClose={onClose} ariaLabel={`Esecuzione ${exerciseName}`}>
      {/* ------------------------------------------------------------------
          Header
          ------------------------------------------------------------------ */}
      <header className="shrink-0 px-6 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold tracking-tight text-on-surface truncate">
            {exerciseName}
          </h2>
          <p className="mt-1 font-sans text-[11px] font-semibold tracking-widest uppercase text-on-surface-variant">
            {meta}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors active:scale-95"
        >
          <X className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </header>

      {/* ------------------------------------------------------------------
          Body
          ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-5">
        {/* Coach's protocol */}
        <div
          className={cn(
            "rounded-2xl p-4",
            "bg-surface-container/50 border-l-4 border-brand-container",
            "border border-brand-container/15",
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <Megaphone
              className="h-4 w-4 text-brand-container"
              strokeWidth={2}
              aria-hidden="true"
            />
            <h3 className="font-display text-[11px] font-bold tracking-widest uppercase text-brand-container">
              Note del Coach
            </h3>
          </div>
          <p className="text-sm text-on-surface">
            Eccentrica controllata di 3 secondi. Esplosivo in concentrica. Non sacrificare la
            profondità per il carico.
          </p>
          {previousReference && (
            <p className="mt-3 font-sans text-[11px] text-on-surface-variant">
              <span className="font-semibold tracking-wider uppercase">Precedente</span> ·{" "}
              {previousReference}
            </p>
          )}
        </div>

        {/* Completed sets — derived from the store */}
        <section aria-label="Serie completate" className="flex flex-col gap-2">
          <h3 className="font-display text-[11px] font-bold tracking-widest uppercase text-on-surface-variant px-1">
            Serie Completate ({completedSets.length})
          </h3>
          {completedSets.length === 0 ? (
            <p className="px-1 text-sm italic text-on-surface-variant/70">
              Nessuna serie ancora loggata. Compila kg + reps qui sotto e tocca "Aggiungi Set".
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {completedSets.map((set, idx) => (
                <li
                  key={set.id}
                  className={cn(
                    "grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_28px] gap-2 items-center",
                    "rounded-2xl p-3",
                    "bg-brand-container/10 border border-brand-container/20",
                  )}
                >
                  <span className="font-display text-sm font-bold text-brand-container text-center tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="font-display text-sm font-semibold text-on-surface text-center tabular-nums">
                    {set.weight}{" "}
                    <span className="text-on-surface-variant text-xs font-normal">kg</span>
                  </span>
                  <span className="font-display text-sm font-semibold text-on-surface text-center tabular-nums">
                    {set.reps}{" "}
                    <span className="text-on-surface-variant text-xs font-normal">reps</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 rounded-md bg-brand-container text-white flex items-center justify-center"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Prominent rest-timer entry point — placeholder action until
            the full countdown widget lands. */}
        <button
          type="button"
          onClick={() =>
            toast("Timer recupero", {
              description: `Conto alla rovescia di ${restSeconds} secondi (placeholder).`,
            })
          }
          aria-label={`Timer recupero ${restSeconds} secondi`}
          className={cn(
            "w-full inline-flex items-center justify-center gap-2 rounded-2xl",
            "px-4 py-3",
            "bg-brand-container text-white",
            "font-sans text-sm font-bold tracking-wide uppercase",
            "shadow-[0_8px_18px_rgba(34,111,163,0.25)]",
            "transition-all duration-150 active:scale-[0.98] hover:brightness-110",
          )}
        >
          <Timer className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Recupero · {restSeconds}s
        </button>

        {/* Active input row */}
        <section
          aria-label="Logga la prossima serie"
          className={cn(
            "rounded-2xl p-4",
            "bg-white border-2 border-brand-container/50",
            "flex flex-col gap-3",
          )}
        >
          <h3 className="font-display text-[11px] font-bold tracking-widest uppercase text-brand-container">
            Serie {completedSets.length + 1}
          </h3>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-sans text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">
                Peso (kg)
              </span>
              <input
                ref={weightInputRef}
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0"
                className={cn(
                  "w-full h-12 rounded-xl text-center font-display text-lg font-bold tabular-nums",
                  "bg-surface-container/60 text-on-surface border border-transparent",
                  "outline-none focus:bg-white focus:border-brand-container focus:ring-2 focus:ring-brand-container/30",
                  "placeholder:text-on-surface-variant/40",
                )}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-sans text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">
                Ripetizioni
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="0"
                className={cn(
                  "w-full h-12 rounded-xl text-center font-display text-lg font-bold tabular-nums",
                  "bg-surface-container/60 text-on-surface border border-transparent",
                  "outline-none focus:bg-white focus:border-brand-container focus:ring-2 focus:ring-brand-container/30",
                  "placeholder:text-on-surface-variant/40",
                )}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleLogSet}
            disabled={!canLog}
            className={cn(
              "mt-1 py-3 rounded-full",
              "flex items-center justify-center gap-1.5",
              "bg-brand-container text-white",
              "font-display text-xs font-bold tracking-widest uppercase",
              "shadow-[0_6px_18px_rgba(34,111,163,0.25)]",
              "transition-all duration-200",
              "hover:brightness-110 active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "disabled:active:scale-100 disabled:hover:brightness-100",
            )}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Aggiungi Set
          </button>
        </section>
      </div>

      {/* ------------------------------------------------------------------
          Sticky footer
          ------------------------------------------------------------------ */}
      <footer className="shrink-0 px-6 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] border-t border-[#c0c7d0]/30 bg-white/85 backdrop-blur-xl">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "w-full h-14 rounded-full",
            "flex items-center justify-center gap-2",
            "bg-on-surface text-white",
            "font-display text-sm font-bold tracking-widest uppercase",
            "shadow-[0_8px_20px_rgba(0,30,45,0.25)]",
            "transition-all duration-200",
            "hover:brightness-110 active:scale-[0.98]",
          )}
        >
          <Play className="h-5 w-5 fill-white" strokeWidth={0} aria-hidden="true" />
          Termina Esercizio
        </button>
      </footer>
    </DrawerShell>
  );
}
