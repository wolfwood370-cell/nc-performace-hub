// =============================================================================
// src/pages/athlete/TrainingAnalytics.tsx
// =============================================================================
// Phase 9 — Training Analytics hub.
//
// Adapted from training_metrics_analytics.html. Composition:
//   - Top header with back button, page title, settings placeholder.
//   - Segmented control: "Diario" (links back to /athlete/training)
//     vs "Metriche" (this page).
//   - Hero card: estimated 1RM with inline SVG gradient trend curve.
//   - 2-col stats grid: weekly volume, average RPE.
//   - Volume distribution: muscle-group progress bars (Quadricipiti,
//     Pettorali, Femorali — last one warning-tinted at 50%).
//   - ACWR card → links to /athlete/analytics/acwr.
//   - Recent personal records list.
//
// Mount: SIBLING of <AthleteLayout> at /athlete/analytics. The page has
// its own back affordance; no global bottom nav.
// =============================================================================

import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Settings,
  TrendingUp,
  Trophy,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Mock data
// =============================================================================
const E1RM = {
  exercise: "Back Squat",
  valueKg: 142.5,
  deltaKg: 2.5,
  deltaPeriod: "questo mese",
};

const WEEKLY = {
  volume: "42.8k",
  volumeDelta: "+5% vs w1",
  rpeAvg: "8.2",
  rpeNote: "Ottimale per ipertrofia",
};

const VOLUME_DISTRIBUTION = [
  { id: "quads", label: "Quadricipiti", current: 12, target: 14, percent: 85, status: "ok" as const },
  { id: "pecs", label: "Pettorali", current: 10, target: 12, percent: 80, status: "ok" as const },
  { id: "hams", label: "Femorali", current: 6, target: 12, percent: 50, status: "warn" as const },
];

const PRS = [
  { id: "rdl", name: "Romanian Deadlift", note: "Nuovo 8RM · 110 kg", when: "Oggi" },
  { id: "ohp", name: "Overhead Press", note: "Nuovo Vol Max · 60 kg × 10", when: "2 gg fa" },
];

// =============================================================================
// E1rmHeroCard
// =============================================================================
function E1rmHeroCard() {
  return (
    <section
      aria-label="Forza stimata"
      className={cn(
        "rounded-3xl p-6",
        "bg-white/70 backdrop-blur-xl border border-[#c0c7d0]/30",
        "shadow-[0_10px_40px_-10px_rgba(80,118,142,0.15)]",
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="font-sans text-[11px] font-semibold tracking-widest uppercase text-on-surface-variant mb-1">
            Forza Stimata (e1RM)
          </h2>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tabular-nums text-brand-container">
              {E1RM.valueKg}
            </span>
            <span className="text-base text-on-surface-variant">kg</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            <span className="font-sans text-[11px] font-semibold">
              +{E1RM.deltaKg} kg {E1RM.deltaPeriod}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container/60 text-brand-container font-sans text-[11px] font-semibold">
          {E1RM.exercise}
        </span>
      </div>

      {/* Inline SVG trend with gradient fill */}
      <div className="h-24 w-full mt-3 relative">
        <svg
          className="w-full h-full"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="e1rmGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#226fa3" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#226fa3" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,80 Q50,75 100,60 T200,40 T300,20 T400,10"
            fill="none"
            stroke="#226fa3"
            strokeLinecap="round"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0,80 Q50,75 100,60 T200,40 T300,20 T400,10 L400,100 L0,100 Z"
            fill="url(#e1rmGradient)"
          />
        </svg>
        <div className="absolute -bottom-1 inset-x-0 flex justify-between px-2 text-on-surface-variant/70">
          <span className="font-sans text-[10px] font-semibold">Feb</span>
          <span className="font-sans text-[10px] font-semibold">Mar</span>
          <span className="font-sans text-[10px] font-semibold">Apr</span>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// StatGlanceCards
// =============================================================================
function StatGlanceCards() {
  return (
    <section className="grid grid-cols-2 gap-3">
      <div className="rounded-3xl p-5 bg-white/70 backdrop-blur-xl border border-[#c0c7d0]/30 flex flex-col justify-between h-32">
        <h3 className="font-sans text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">
          Volume Settimanale
        </h3>
        <div>
          <div className="font-display text-2xl font-semibold tabular-nums text-brand-container">
            {WEEKLY.volume}
          </div>
          <div className="font-sans text-[11px] font-semibold text-emerald-600">
            {WEEKLY.volumeDelta}
          </div>
        </div>
      </div>
      <div className="rounded-3xl p-5 bg-white/70 backdrop-blur-xl border border-[#c0c7d0]/30 flex flex-col justify-between h-32">
        <h3 className="font-sans text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">
          Sforzo Medio (RPE)
        </h3>
        <div>
          <div className="font-display text-2xl font-semibold tabular-nums text-brand-container">
            {WEEKLY.rpeAvg}
          </div>
          <div className="font-sans text-[11px] text-on-surface-variant">
            {WEEKLY.rpeNote}
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// VolumeDistributionCard
// =============================================================================
function VolumeDistributionCard() {
  return (
    <section
      aria-label="Distribuzione volume per gruppo muscolare"
      className="rounded-3xl p-6 bg-white/70 backdrop-blur-xl border border-[#c0c7d0]/30"
    >
      <h3 className="font-display text-lg font-semibold text-on-surface mb-4">
        Distribuzione Volume
      </h3>
      <div className="flex flex-col gap-4">
        {VOLUME_DISTRIBUTION.map((row) => (
          <div key={row.id}>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-on-surface">{row.label}</span>
              <span className="font-sans text-[11px] font-semibold text-on-surface-variant">
                {row.current}/{row.target} Set
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden bg-surface-container">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  row.status === "warn" ? "bg-amber-500" : "bg-brand-container",
                )}
                style={{ width: `${row.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// AcwrCallout — links to the ACWR detail page.
// =============================================================================
function AcwrCallout() {
  return (
    <Link
      to="/athlete/analytics/acwr"
      aria-label="Apri analisi carico di lavoro (ACWR)"
      className={cn(
        "rounded-3xl p-5",
        "bg-white/70 backdrop-blur-xl border border-[#c0c7d0]/30",
        "border-l-4 border-l-brand-container",
        "flex items-center justify-between gap-3",
        "transition-transform active:scale-[0.99]",
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <span
          aria-hidden="true"
          className="h-10 w-10 rounded-full bg-brand-container/10 flex items-center justify-center text-brand-container"
        >
          <Activity className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h4 className="font-display text-sm font-semibold text-on-surface">
            Carico di Lavoro · ACWR
          </h4>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Acuto vs cronico, sweet spot, rischio infortuni.
          </p>
        </div>
      </div>
      <ChevronRight
        className="h-5 w-5 text-on-surface-variant shrink-0"
        strokeWidth={2}
        aria-hidden="true"
      />
    </Link>
  );
}

// =============================================================================
// RecentPrCard
// =============================================================================
function RecentPrCard() {
  return (
    <section
      aria-label="Record recenti"
      className={cn(
        "rounded-3xl p-6",
        "bg-white/70 backdrop-blur-xl border border-[#c0c7d0]/30",
        "border-l-4 border-l-emerald-500",
      )}
    >
      <h3 className="font-display text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-emerald-500" strokeWidth={2} aria-hidden="true" />
        Record Recenti
      </h3>
      <ul className="flex flex-col gap-4">
        {PRS.map((pr) => (
          <li key={pr.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="h-10 w-10 shrink-0 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center"
            >
              <Award className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="font-display text-sm font-semibold text-on-surface">
                {pr.name}
              </h4>
              <p className="font-sans text-[11px] font-semibold text-emerald-600 mt-0.5">
                {pr.note}
              </p>
            </div>
            <span className="font-sans text-[11px] text-on-surface-variant shrink-0">
              {pr.when}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// =============================================================================
// TrainingAnalytics — page composition.
// =============================================================================
export default function TrainingAnalytics() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-surface text-on-surface font-sans antialiased pb-12">
      {/* Top bar */}
      <header
        className={cn(
          "sticky top-0 z-40 w-full",
          "backdrop-blur-md bg-white/70",
          "border-b border-[#c0c7d0]/30",
          "px-5 pt-4 pb-2",
        )}
      >
        <div className="flex items-center justify-between h-12">
          <button
            type="button"
            onClick={() => navigate("/athlete/training")}
            aria-label="Torna agli allenamenti"
            className="h-10 w-10 rounded-full flex items-center justify-center text-brand-container hover:bg-surface-container/60 transition-colors active:scale-95"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </button>
          <h1 className="font-display text-lg font-bold tracking-tight text-brand-container">
            Training Hub
          </h1>
          <button
            type="button"
            aria-label="Impostazioni"
            className="h-10 w-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container/60 transition-colors active:scale-95"
          >
            <Settings className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Diario / Metriche segmented control */}
        <div className="mt-2 mb-1 w-full p-1 rounded-full bg-surface-container/60 flex">
          <button
            type="button"
            onClick={() => navigate("/athlete/training")}
            className="flex-1 py-2 text-center font-display text-xs font-semibold text-on-surface-variant rounded-full transition-colors active:scale-95"
          >
            Diario
          </button>
          <button
            type="button"
            aria-current="page"
            className="flex-1 py-2 text-center font-display text-xs font-bold text-brand-container bg-white shadow-[0_4px_12px_rgba(80,118,142,0.08)] rounded-full"
          >
            Metriche
          </button>
        </div>
      </header>

      <main className="px-5 py-6 max-w-3xl mx-auto flex flex-col gap-5">
        <E1rmHeroCard />
        <StatGlanceCards />
        <VolumeDistributionCard />
        <AcwrCallout />
        <RecentPrCard />
      </main>
    </div>
  );
}
