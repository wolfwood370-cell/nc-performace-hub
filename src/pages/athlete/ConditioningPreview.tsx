import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, Play, MoreVertical } from "lucide-react";
import { useTodaysWorkout } from "@/hooks/useTodaysWorkout";
import { useActiveSessionStore } from "@/stores/useActiveSessionStore";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import type { WorkoutStructureExercise } from "@/types/database";

interface ConditioningStation {
  cadence: string;
  title: string;
  notes: string;
}

const ORDINALS = [
  ["1", "3", "5..."],
  ["2", "4", "6..."],
  ["3", "6", "9..."],
];

const detectProtocol = (notes?: string, name?: string): string | null => {
  const hay = `${notes ?? ""} ${name ?? ""}`.toUpperCase();
  if (/EMOM\s*\d+/i.test(hay)) {
    const m = hay.match(/EMOM\s*(\d+)/i);
    return `EMOM ${m?.[1] ?? ""} Minuti`.trim();
  }
  if (/AMRAP\s*\d+/i.test(hay)) {
    const m = hay.match(/AMRAP\s*(\d+)/i);
    return `AMRAP ${m?.[1] ?? ""} Minuti`.trim();
  }
  if (hay.includes("EMOM")) return "EMOM";
  if (hay.includes("AMRAP")) return "AMRAP";
  return null;
};

const ConditioningPreview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupParam = searchParams.get("group") ?? "D";

  const { workout, isLoading } = useTodaysWorkout();
  const startFreeSession = useActiveSessionStore((s) => s.startFreeSession);
  const isActive = useActiveSessionStore((s) => s.isActive);

  const block = useMemo(() => {
    if (!workout?.structure)
      return { title: "Engine Builder", protocol: "EMOM", description: "", stations: [] as ConditioningStation[] };

    // Pull every exercise that belongs to the requested conditioning group.
    let exercises: WorkoutStructureExercise[] = workout.structure.filter(
      (ex) => (ex.supersetGroup ?? "").toUpperCase() === groupParam.toUpperCase(),
    );

    // Fallback: any exercise whose notes/name flag a metabolic protocol.
    if (exercises.length === 0) {
      exercises = workout.structure.filter((ex) =>
        detectProtocol(ex.notes, ex.name),
      );
    }

    const protocolLabel =
      exercises.map((ex) => detectProtocol(ex.notes, ex.name)).find(Boolean) ??
      "EMOM";

    const stations: ConditioningStation[] = exercises.map((ex, idx) => {
      const cadence = ORDINALS[idx % ORDINALS.length].join(", ");
      return {
        cadence: `Minuto ${cadence}`,
        title: `${ex.reps}x ${ex.name}`,
        notes:
          ex.notes ?? "Mantieni un ritmo costante. Il tempo rimanente è recupero.",
      };
    });

    return {
      title: workout.title,
      protocol: protocolLabel,
      description:
        workout.description ??
        "Lavoro metabolico alternato. Rispetta la finestra di lavoro del minuto.",
      stations,
    };
  }, [workout, groupParam]);

  const handleStart = () => {
    if (!isActive) startFreeSession();
    // Navigate into the AMRAP/EMOM execution timer.
    navigate("/athlete/amrap-execution");
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* 1. Top App Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-white/70 backdrop-blur-xl border-b border-surface-variant/50 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="text-on-surface hover:bg-surface-variant/50 p-2 rounded-full transition-colors"
          aria-label="Torna indietro"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-semibold tracking-tight text-lg text-on-surface">
          Panoramica Allenamento
        </h1>
        <button
          className="text-on-surface hover:bg-surface-variant/50 p-2 rounded-full transition-colors"
          aria-label="Altre opzioni"
        >
          <MoreVertical size={20} />
        </button>
      </header>

      {/* 2. Main Layout */}
      <main className="pt-24 pb-32 px-6 max-w-md mx-auto w-full">
        {/* 3. Protocol Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-surface-variant/50">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="font-semibold text-[10px] text-inverse-surface uppercase tracking-widest mb-2 block">
                Blocco di Condizionamento
              </span>
              <h2 className="font-display text-2xl font-bold text-inverse-surface">
                {block.title}
              </h2>
            </div>
            <div className="bg-primary-container text-white font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <Clock size={16} />
              <span>{block.protocol}</span>
            </div>
          </div>

          <p className="text-on-surface-variant text-sm mb-8 max-w-xl">
            {block.description}
          </p>

          {/* 4. Blueprint Container (Circuit Logic) */}
          <div className="bg-surface-container-low rounded-xl p-6">
            {block.stations.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center">
                Nessuna stazione configurata per questo blocco.
              </p>
            )}
            {block.stations.map((station, idx) => (
              <div key={`${station.cadence}-${idx}`}>
                {idx > 0 && (
                  <hr className="border-t border-dashed border-surface-variant/80 my-6" />
                )}
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <span className="bg-white text-inverse-surface font-bold text-xs px-4 py-2 rounded-full shadow-sm whitespace-nowrap shrink-0 border border-surface-variant/50">
                    {station.cadence}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-inverse-surface mb-1">
                      {station.title}
                    </h3>
                    <p className="text-sm text-on-surface-variant">{station.notes}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 5. Sticky Footer Action */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-white via-white/95 to-transparent pb-[env(safe-area-inset-bottom,24px)]">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleStart}
            className="w-full bg-primary-container text-white font-display font-bold text-lg py-4 rounded-full shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>INIZIA SESSIONE</span>
            <Play size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConditioningPreview;
