import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  X,
  PlayCircle,
  CheckCircle,
  Circle,
  Lightbulb,
  ChevronsRight,
} from "lucide-react";
import { useActiveSessionStore } from "@/stores/useActiveSessionStore";
import { useTodaysWorkout } from "@/hooks/useTodaysWorkout";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { WorkoutStructureExercise } from "@/types/database";

interface ResolvedBlock {
  exerciseId: string;
  code: string;
  name: string;
  sets: number;
  reps: string;
  load?: string;
  videoUrl?: string;
  notes?: string;
}

const buildExerciseId = (ex: WorkoutStructureExercise, index: number) =>
  ex.id ?? `${ex.name}-${index}`;

export default function SupersetExecution() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupParam = searchParams.get("group") ?? "A";

  const { workout, isLoading } = useTodaysWorkout();
  const sessionLogs = useActiveSessionStore((s) => s.sessionLogs);
  const updateSetField = useActiveSessionStore((s) => s.updateSetField);
  const completeSet = useActiveSessionStore((s) => s.completeSet);
  const isActive = useActiveSessionStore((s) => s.isActive);
  const startFreeSession = useActiveSessionStore((s) => s.startFreeSession);

  // Pull exercises that share the requested superset group from the workout structure.
  const blocks: ResolvedBlock[] = useMemo(() => {
    if (!workout?.structure) return [];
    const grouped = workout.structure
      .map((ex, index) => ({ ex, index }))
      .filter(
        ({ ex }) =>
          (ex.supersetGroup ?? "").toUpperCase() === groupParam.toUpperCase(),
      );
    const list = grouped.length >= 2 ? grouped : workout.structure.slice(0, 2).map((ex, index) => ({ ex, index }));
    return list.map(({ ex, index }, position) => ({
      exerciseId: buildExerciseId(ex, index),
      code: `${groupParam.toUpperCase()}${position + 1}`,
      name: ex.name,
      sets: ex.sets ?? 3,
      reps: ex.reps ?? "—",
      load: ex.load,
      videoUrl: ex.videoUrl,
      notes: ex.notes,
    }));
  }, [workout, groupParam]);

  // Ensure a session exists so completeSet has a stable bucket to write into.
  const ensureSession = () => {
    if (!isActive) startFreeSession();
  };

  const getSet = (exerciseId: string, setIdx: number) =>
    sessionLogs[exerciseId]?.find((l) => l.setIndex === setIdx);

  const handleField = (
    exerciseId: string,
    setIdx: number,
    field: "actualKg" | "actualReps",
    value: string,
  ) => {
    ensureSession();
    updateSetField(exerciseId, setIdx, field, value);
  };

  const handleToggle = (block: ResolvedBlock, setIdx: number) => {
    ensureSession();
    const current = getSet(block.exerciseId, setIdx);
    completeSet(block.exerciseId, setIdx, {
      actualKg: current?.actualKg || block.load || "",
      actualReps: current?.actualReps || block.reps || "",
      rpe: current?.rpe || "",
      completed: !current?.completed,
    });
  };

  const handleFinish = () => {
    // Mark the final state and exit. Persistence to workout_logs happens in the
    // post-workout debrief via useActiveSessionStore.sessionLogs.
    navigate(-1);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Tip surfaced from the first exercise notes when present.
  const coachTip =
    blocks.find((b) => b.notes)?.notes ??
    "Mantieni un tempo controllato. Riposa solo dopo aver completato tutti gli esercizi del blocco.";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-inverse-surface/10 backdrop-blur-[2px]"
        onClick={() => navigate(-1)}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 w-full max-w-2xl mx-auto bg-white rounded-t-3xl shadow-2xl z-50 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-surface-variant/50 sticky top-0 z-50 flex flex-col items-center pt-2">
          <div className="w-12 h-1.5 bg-surface-variant rounded-full mt-3 mb-4" />
          <div className="flex justify-between items-center px-6 pb-4 w-full">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold text-on-surface tracking-tight">
                Blocco {groupParam.toUpperCase()}: Superset
              </h2>
              <p className="text-sm text-on-surface-variant">
                Completa {blocks.map((b) => b.code).join(" e ")} consecutivamente, poi recupera.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-primary w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container active:scale-95 shrink-0"
              aria-label="Chiudi"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-12">
          {blocks.length === 0 && (
            <p className="text-center text-on-surface-variant text-sm">
              Nessun blocco superset programmato per oggi.
            </p>
          )}

          {blocks.map((block) => (
            <section
              key={block.exerciseId}
              className="relative border-l-4 border-primary pl-6 ml-1"
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="font-display text-2xl font-bold text-on-surface">
                  {block.code}. {block.name}
                </h3>
                {block.videoUrl && (
                  <a
                    href={block.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-primary-container font-semibold text-sm hover:underline"
                  >
                    <PlayCircle className="w-5 h-5" />
                    Guarda Video
                  </a>
                )}
              </div>

              {/* Headers */}
              <div className="grid grid-cols-5 gap-3 text-center mb-4">
                {["Set", "Precedente", "Kg", "Reps", "Fatto"].map((h) => (
                  <span
                    key={h}
                    className="text-xs text-outline uppercase font-semibold"
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-3">
                {Array.from({ length: block.sets }).map((_, si) => {
                  const stored = getSet(block.exerciseId, si);
                  const kgValue = stored?.actualKg ?? block.load ?? "";
                  const repsValue = stored?.actualReps ?? block.reps ?? "";
                  const completed = stored?.completed ?? false;
                  const previousLabel =
                    block.load && block.reps
                      ? `${block.load} x ${block.reps}`
                      : "—";
                  return (
                    <div
                      key={si}
                      className="grid grid-cols-5 gap-3 items-center"
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm mx-auto bg-primary-container text-white">
                        {si + 1}
                      </div>
                      <span className="text-center font-medium text-sm text-on-surface-variant">
                        {previousLabel}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={kgValue}
                        onChange={(e) =>
                          handleField(block.exerciseId, si, "actualKg", e.target.value)
                        }
                        className="w-full h-12 rounded-lg text-center font-display text-xl text-on-surface focus:outline-none bg-surface-container-low border-2 border-primary-container"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={repsValue}
                        onChange={(e) =>
                          handleField(block.exerciseId, si, "actualReps", e.target.value)
                        }
                        className="w-full h-12 rounded-lg text-center font-display text-xl text-on-surface focus:outline-none bg-surface-container-low border-none focus:ring-2 focus:ring-primary-container"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggle(block, si)}
                        className="w-10 h-10 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center text-outline-variant hover:text-primary-container hover:border-primary-container mx-auto"
                        aria-label="Segna come completato"
                      >
                        {completed ? (
                          <CheckCircle className="w-5 h-5 text-primary-container" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Coaching Insight */}
          <div className="relative border-l-4 border-primary">
            <div className="bg-white/70 backdrop-blur-xl border border-surface-variant/50 p-6 rounded-r-xl flex items-start gap-4 shadow-sm">
              <Lightbulb className="w-6 h-6 text-primary-container shrink-0" />
              <div>
                <div className="text-xs font-bold uppercase text-primary-container mb-1">
                  Consiglio Esecuzione
                </div>
                <p className="text-on-surface-variant text-sm">{coachTip}</p>
              </div>
            </div>
          </div>

          <div className="h-24" />
        </div>

        {/* Sticky Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent pt-10 z-10">
          <button
            type="button"
            onClick={handleFinish}
            className="w-full h-16 bg-primary-container text-white font-display font-bold text-xl rounded-full shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            Termina Superset
            <ChevronsRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </>
  );
}
