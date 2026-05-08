import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  MoreVertical,
  CheckCircle2,
  Info,
  Dumbbell,
  ArrowUpDown,
  Play,
} from "lucide-react";
import { ExitWorkoutDialog } from "@/components/athlete/ActiveWorkout/ExitWorkoutDialog";
import { useActiveSessionStore } from "@/stores/useActiveSessionStore";
import { useWorkoutAutosave } from "@/hooks/useWorkoutAutosave";
import { toast } from "sonner";

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ActiveWorkout() {
  const navigate = useNavigate();
  useWorkoutAutosave();
  const [exitOpen, setExitOpen] = useState(false);

  const startedAt = useActiveSessionStore((s) => s.startedAt);
  const endSession = useActiveSessionStore((s) => s.endSession);
  const markDoneLocally = useActiveSessionStore((s) => s.markDoneLocally);
  const cancelRestTimer = useActiveSessionStore((s) => s.cancelRestTimer);

  const startMs = useMemo(
    () => (startedAt ? new Date(startedAt).getTime() : Date.now()),
    [startedAt],
  );
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  const handleResume = () => setExitOpen(false);
  const handleFinish = () => {
    cancelRestTimer();
    markDoneLocally();
    toast.success("Allenamento salvato");
    setExitOpen(false);
    navigate("/athlete/training");
  };
  const handleDiscard = () => {
    cancelRestTimer();
    endSession();
    toast.info("Allenamento scartato");
    setExitOpen(false);
    navigate("/athlete/training");
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Top App Bar & Progress */}
      <header className="fixed top-0 left-0 w-full z-50 bg-white/90 backdrop-blur-md">
        <div className="flex justify-between items-center px-6 py-4">
          <button
            onClick={() => setExitOpen(true)}
            className="text-on-surface hover:bg-surface-variant/50 p-2 -ml-2 rounded-full transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-on-surface-variant">
              Workout Hub
            </span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
              <span className="font-display text-lg font-bold text-primary-container tabular-nums">
                {formatTimer(elapsed)}
              </span>
            </div>
          </div>

          <button
            className="text-on-surface hover:bg-surface-variant/50 p-2 -mr-2 rounded-full transition-colors"
            aria-label="Altre opzioni"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-surface-container-low h-1 w-full">
          <div className="bg-primary-container h-full w-[30%]" />
        </div>
      </header>

      {/* Main */}
      <main className="pt-[100px] pb-[100px] px-6 max-w-md mx-auto flex flex-col gap-8">
        {/* Phase 1: Completed */}
        <section className="opacity-60">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="text-green-500 bg-green-500/10 rounded-full p-1 w-6 h-6" />
            <h2 className="font-display text-xl font-semibold text-on-surface">
              Fase 1: Riscaldamento
            </h2>
          </div>
          <div className="bg-white border border-surface-variant/50 rounded-3xl p-6 flex flex-col gap-4">
            <div>
              <p className="font-semibold text-on-surface line-through">
                90/90 Stretch
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                2 Set x 10 Reps per lato
              </p>
            </div>
            <div className="border-t border-surface-variant/50 pt-4">
              <p className="font-semibold text-on-surface line-through">
                Cat-Cow
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                1 Set x 15 Reps
              </p>
            </div>
          </div>
        </section>

        {/* Phase 2: Active */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm">
              2
            </span>
            <h2 className="font-display text-xl font-semibold text-on-surface">
              Fase 2: Sessione Principale
            </h2>
          </div>

          {/* Active Exercise Card */}
          <div className="bg-white border border-primary-container/40 rounded-[32px] p-6 shadow-sm relative overflow-hidden">
            <span className="absolute top-0 left-0 w-1.5 h-full bg-primary-container" />

            <div className="flex justify-between items-start">
              <h3 className="font-display text-xl font-bold text-on-surface">
                A1. Squat con Bilanciere
              </h3>
              <button
                className="text-on-surface-variant p-2 -mt-2 -mr-2 rounded-full hover:bg-surface-variant/50 transition-colors"
                aria-label="Info esercizio"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-semibold text-primary-container mt-1">
              2/4 Set Completati
            </p>

            {/* Set Pills */}
            <div className="flex gap-2 my-6">
              <span className="w-8 h-1.5 rounded-full bg-primary-container" />
              <span className="w-8 h-1.5 rounded-full bg-primary-container" />
              <span className="w-8 h-1.5 rounded-full bg-surface-variant" />
              <span className="w-8 h-1.5 rounded-full bg-surface-variant" />
            </div>

            {/* Target Box */}
            <div className="bg-surface-container-low rounded-2xl p-4 flex justify-between items-center relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-[10px] font-semibold uppercase text-on-surface-variant tracking-wider">
                  Target Set 3
                </p>
                <p className="mt-1">
                  <span className="font-display text-4xl font-bold text-on-surface">
                    8
                  </span>
                  <span className="text-lg font-normal text-on-surface-variant">
                    {" "}Reps @{" "}
                  </span>
                  <span className="font-display text-4xl font-bold text-on-surface">
                    100
                  </span>
                  <span className="text-lg font-normal text-on-surface-variant">
                    {" "}kg
                  </span>
                </p>
              </div>
              <Dumbbell className="absolute -right-4 text-primary-container opacity-10 w-24 h-24" />
            </div>
          </div>

          {/* Upcoming Exercises */}
          <div className="flex flex-col gap-4 mt-4">
            <div className="bg-white border border-surface-variant/50 rounded-3xl p-6 flex justify-between items-center">
              <div>
                <p className="font-semibold text-on-surface">
                  B1. Stacchi Romeni
                </p>
                <p className="text-xs text-on-surface-variant mt-1">0/3 Set</p>
              </div>
              <ArrowUpDown className="w-5 h-5 text-on-surface-variant" />
            </div>
            <div className="bg-white border border-surface-variant/50 rounded-3xl p-6 flex justify-between items-center">
              <div>
                <p className="font-semibold text-on-surface">
                  B2. Trazioni Zavorrate
                </p>
                <p className="text-xs text-on-surface-variant mt-1">0/3 Set</p>
              </div>
              <ArrowUpDown className="w-5 h-5 text-on-surface-variant" />
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-surface-variant p-6 z-50">
        <div className="flex gap-4 max-w-md mx-auto">
          <button className="w-[70%] bg-surface-container text-on-surface font-semibold py-4 rounded-full hover:bg-surface-variant transition-colors flex items-center justify-center gap-2 active:scale-95">
            <Play className="w-4 h-4" />
            Riprendi A1. Squat
          </button>
          <button
            onClick={() => setExitOpen(true)}
            className="w-[30%] bg-[#001e2d] text-white font-semibold py-4 rounded-full transition-colors flex items-center justify-center active:scale-95 shadow-lg"
          >
            Termina
          </button>
        </div>
      </div>

      <ExitWorkoutDialog
        isOpen={exitOpen}
        onResume={handleResume}
        onFinish={handleFinish}
        onDiscard={handleDiscard}
        timerDuration={formatTimer(elapsed)}
      />
    </div>
  );
}
