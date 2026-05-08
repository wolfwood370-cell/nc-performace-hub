import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  PlayCircle,
  CheckCircle,
  Circle,
  Lightbulb,
  ChevronsRight,
} from "lucide-react";

interface SetRow {
  set: number;
  prev: string;
  kg: string;
  reps: string;
  completed: boolean;
  active: boolean;
}

interface ExerciseBlock {
  code: string;
  name: string;
  sets: SetRow[];
}

const initialBlocks: ExerciseBlock[] = [
  {
    code: "A1",
    name: "Barbell Back Squat",
    sets: [
      { set: 1, prev: "100 kg x 8", kg: "105", reps: "8", completed: false, active: true },
      { set: 2, prev: "100 kg x 8", kg: "105", reps: "8", completed: false, active: false },
      { set: 3, prev: "100 kg x 8", kg: "105", reps: "8", completed: false, active: false },
    ],
  },
  {
    code: "A2",
    name: "Romanian Deadlift",
    sets: [
      { set: 1, prev: "80 kg x 10", kg: "85", reps: "10", completed: false, active: true },
      { set: 2, prev: "80 kg x 10", kg: "85", reps: "10", completed: false, active: false },
      { set: 3, prev: "80 kg x 10", kg: "85", reps: "10", completed: false, active: false },
    ],
  },
];

export default function SupersetExecution() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<ExerciseBlock[]>(initialBlocks);

  const updateSet = (
    blockIdx: number,
    setIdx: number,
    field: "kg" | "reps",
    value: string
  ) => {
    setBlocks((prev) =>
      prev.map((b, bi) =>
        bi !== blockIdx
          ? b
          : {
              ...b,
              sets: b.sets.map((s, si) =>
                si !== setIdx ? s : { ...s, [field]: value }
              ),
            }
      )
    );
  };

  const toggleDone = (blockIdx: number, setIdx: number) => {
    setBlocks((prev) =>
      prev.map((b, bi) =>
        bi !== blockIdx
          ? b
          : {
              ...b,
              sets: b.sets.map((s, si) =>
                si !== setIdx ? s : { ...s, completed: !s.completed }
              ),
            }
      )
    );
  };

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
                Blocco A: Superset
              </h2>
              <p className="text-sm text-on-surface-variant">
                Completa A1 e A2 consecutivamente, poi recupera.
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
          {blocks.map((block, bi) => (
            <section
              key={block.code}
              className="relative border-l-4 border-primary pl-6 ml-1"
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="font-display text-2xl font-bold text-on-surface">
                  {block.code}. {block.name}
                </h3>
                <button
                  type="button"
                  className="flex items-center gap-2 text-primary-container font-semibold text-sm hover:underline"
                >
                  <PlayCircle className="w-5 h-5" />
                  Guarda Video
                </button>
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
                {block.sets.map((row, si) => {
                  const pending = !row.active;
                  return (
                    <div
                      key={si}
                      className={`grid grid-cols-5 gap-3 items-center ${
                        pending ? "opacity-40 pointer-events-none" : ""
                      }`}
                    >
                      <div
                        className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm mx-auto ${
                          pending
                            ? "bg-surface-container text-on-surface-variant"
                            : "bg-primary-container text-white"
                        }`}
                      >
                        {row.set}
                      </div>
                      <span className="text-center font-medium text-sm text-on-surface-variant">
                        {row.prev}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.kg}
                        onChange={(e) => updateSet(bi, si, "kg", e.target.value)}
                        className={`w-full h-12 rounded-lg text-center font-display text-xl text-on-surface focus:outline-none ${
                          pending
                            ? "bg-surface-container-low border-none text-outline"
                            : "bg-surface-container-low border-2 border-primary-container"
                        }`}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.reps}
                        onChange={(e) =>
                          updateSet(bi, si, "reps", e.target.value)
                        }
                        className={`w-full h-12 rounded-lg text-center font-display text-xl text-on-surface focus:outline-none ${
                          pending
                            ? "bg-surface-container-low border-none text-outline"
                            : "bg-surface-container-low border-none focus:ring-2 focus:ring-primary-container"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleDone(bi, si)}
                        className="w-10 h-10 rounded-lg bg-surface-container border border-outline-variant flex items-center justify-center text-outline-variant hover:text-primary-container hover:border-primary-container mx-auto"
                        aria-label="Segna come completato"
                      >
                        {row.completed ? (
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
                <p className="text-on-surface-variant text-sm">
                  Mantieni una spina neutrale durante gli RDL. Concentrati
                  sull'hip hinge per massimizzare il coinvolgimento dei femorali
                  dopo gli squat pesanti.
                </p>
              </div>
            </div>
          </div>

          <div className="h-24" />
        </div>

        {/* Sticky Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent pt-10 z-10">
          <button
            type="button"
            onClick={() => navigate(-1)}
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
