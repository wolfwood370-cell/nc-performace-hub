// =============================================================================
// src/pages/athlete/DailyReadiness.tsx
// =============================================================================
// Phase 9 — Daily Readiness summary.
//
// Adapted from daily_readiness_analysis.html. Single-day score view that
// complements the multi-tab AthleteReadinessDetails (Phase 3) by zooming
// into the contributing factors:
//   - Hero: large circular SVG gauge (85 / 100) + status pill "Ottima".
//   - Factor cards (Qualità del Sonno, HRV, DOMS, Stress Percepito);
//     the DOMS card is amber-flagged with a left warning border.
//   - Replacement for the external context image — clean placeholder
//     div with a brand-tinted gradient and an icon stand-in.
//   - Sticky CTA "Adatta l'allenamento di oggi" linking to the
//     in-session adaptation flow (placeholder).
// =============================================================================

import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  History,
  Info,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const READINESS = {
  score: 85, // 0..100
  status: "Ottima",
  caption: "Sistema nervoso e muscolare pienamente recuperati.",
};

interface Factor {
  id: string;
  label: string;
  /** 0..100 contribution to the overall score. */
  score: number;
  detail: string;
  flag?: "warn";
}

const FACTORS: readonly Factor[] = [
  {
    id: "sleep",
    label: "Qualità del Sonno",
    score: 90,
    detail: "7h 45m dormite · alta percentuale di sonno profondo.",
  },
  {
    id: "hrv",
    label: "Recupero Neurale (HRV)",
    score: 82,
    detail: "Variabilità cardiaca nella tua baseline superiore.",
  },
  {
    id: "doms",
    label: "DOMS & Affaticamento",
    score: 75,
    detail: "Leggero indolenzimento riportato ai femorali.",
    flag: "warn",
  },
  {
    id: "stress",
    label: "Stress Percepito",
    score: 95,
    detail: "Livelli di cortisolo stimati ottimali per la performance.",
  },
] as const;

// =============================================================================
// ReadinessGauge — large SVG circular ring.
// =============================================================================
function ReadinessGauge({ score }: { score: number }) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(0, Math.min(100, score));
  const dashOffset = circumference * (1 - safe / 100);

  return (
    <div
      role="img"
      aria-label={`Punteggio readiness ${safe} su 100`}
      className="relative w-48 h-48 flex items-center justify-center"
    >
      <svg
        className="absolute inset-0 w-full h-full -rotate-90"
        viewBox="0 0 192 192"
        aria-hidden="true"
      >
        <circle
          cx="96"
          cy="96"
          r={radius}
          fill="transparent"
          stroke="#e2e8f0"
          strokeWidth="6"
        />
        <circle
          cx="96"
          cy="96"
          r={radius}
          fill="transparent"
          stroke="#10b981"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="font-display text-5xl font-bold tabular-nums text-on-surface">
          {safe}
        </span>
        <span className="mt-1 font-sans text-[11px] font-semibold tracking-widest uppercase text-on-surface-variant">
          Score
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// FactorCard — single readiness factor card.
// =============================================================================
function FactorCard({ factor }: { factor: Factor }) {
  return (
    <div
      className={cn(
        "rounded-3xl p-6",
        "bg-white/70 backdrop-blur-xl",
        "border border-[#c0c7d0]/30",
        "transition-transform hover:-translate-y-0.5",
        factor.flag === "warn" && "border-l-4 border-l-amber-500",
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-display text-sm font-bold text-on-surface">
          {factor.label}
        </span>
        <span
          className={cn(
            "font-display font-bold tabular-nums",
            factor.flag === "warn" ? "text-amber-600" : "text-emerald-600",
          )}
        >
          {factor.score}/100
        </span>
      </div>
      <p className="text-sm text-on-surface-variant">{factor.detail}</p>
    </div>
  );
}

// =============================================================================
// DailyReadiness — page composition.
// =============================================================================
export default function DailyReadiness() {
  const navigate = useNavigate();

  const handleAdapt = () => {
    toast.message("Adattamento in arrivo", {
      description: "L'adattamento dinamico arriverà nel prossimo step.",
    });
  };

  return (
    <div className="min-h-[100dvh] bg-white text-on-surface font-sans antialiased flex flex-col pb-32">
      {/* Top bar */}
      <header
        className={cn(
          "sticky top-0 z-40 w-full",
          "backdrop-blur-2xl bg-white/70",
          "border-b border-on-surface-variant/10",
          "shadow-sm",
        )}
      >
        <div className="flex items-center justify-between px-5 py-3 h-16">
          <button
            type="button"
            onClick={() => navigate("/athlete/readiness")}
            aria-label="Torna alla readiness"
            className="h-10 w-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container/60 transition-colors active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 className="font-display text-lg font-bold tracking-tight text-on-surface">
            Analisi Prontezza
          </h1>
          <button
            type="button"
            aria-label="Storico readiness"
            className="h-10 w-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container/60 transition-colors active:scale-95"
          >
            <History className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="flex-1 pt-8 px-6 max-w-lg mx-auto w-full">
        {/* Hero score */}
        <section className="flex flex-col items-center mb-10 text-center">
          <ReadinessGauge score={READINESS.score} />
          <h2 className="mt-6 font-display text-2xl font-semibold text-emerald-600">
            {READINESS.status}
          </h2>
          <p className="mt-2 text-base text-on-surface-variant max-w-[280px]">
            {READINESS.caption}
          </p>
        </section>

        {/* Factors */}
        <section aria-label="Fattori di prontezza" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-on-surface">
              Fattori di Prontezza
            </h3>
            <button
              type="button"
              aria-label="Informazioni sui fattori"
              className="h-8 w-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container/60 transition-colors"
            >
              <Info className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {FACTORS.map((f) => (
              <FactorCard key={f.id} factor={f} />
            ))}
          </div>
        </section>

        {/* Coaching context — placeholder div replaces external img */}
        <section className="mt-8 mb-6">
          <div className="relative h-40 w-full rounded-3xl overflow-hidden bg-surface-container-high">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-brand-container/15 via-surface-variant/40 to-emerald-500/15 flex items-center justify-center"
            >
              <Sparkles
                className="h-10 w-10 text-brand-container/40"
                strokeWidth={1.5}
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/55 to-transparent flex items-end p-5">
              <p className="text-white font-display text-sm font-medium">
                Il tuo coaching personalizzato è pronto.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Sticky CTA */}
      <div
        className={cn(
          "fixed bottom-0 inset-x-0 z-40",
          "px-6 pt-10 pb-[max(env(safe-area-inset-bottom),1rem)]",
          "bg-gradient-to-t from-white via-white to-transparent",
        )}
      >
        <button
          type="button"
          onClick={handleAdapt}
          className={cn(
            "w-full max-w-lg mx-auto block",
            "py-4 px-8 rounded-full",
            "bg-surface-container text-on-surface",
            "font-display font-bold",
            "shadow-sm",
            "flex items-center justify-center gap-3",
            "transition-all duration-150 active:scale-95",
          )}
        >
          <SlidersHorizontal
            className="h-5 w-5 text-brand-container"
            strokeWidth={2}
            aria-hidden="true"
          />
          Adatta l'allenamento di oggi
        </button>
      </div>
    </div>
  );
}
