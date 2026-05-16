// =============================================================================
// src/pages/athlete/AcwrAnalysis.tsx
// =============================================================================
// Phase 9 — Acute:Chronic Workload Ratio (ACWR) deep dive.
//
// Adapted from acwr_analysis_details.html. No external chart library —
// everything is inline SVG / Tailwind divs:
//   - Semicircular gauge: three zone arcs (risk-amber / sweet-green /
//     danger-red) over a neutral track + a needle anchored at the
//     center of the half-circle, rotated to reflect the current ratio.
//   - Score (1.15) below the gauge + "Sweet Spot" chip + caption.
//   - Acute (7d) vs Chronic (28d) breakdown row.
//   - Trend chart card: green "Optimal Zone" band behind a hand-rolled
//     SVG path with cubic-bezier waves + a current-point marker.
//   - Coach's insight (left brand border).
//   - Context image → replaced with a clean placeholder div per brief.
// =============================================================================

import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Dumbbell,
  Info,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ACWR = {
  ratio: 1.15,
  zone: "Sweet Spot" as const,
  zoneCaption: "Adattamento ottimale. Rischio infortuni minimizzato.",
  acuteKg: 12_450,
  chronicKg: 10_820,
};

const TREND_LABELS = ["4 sett fa", "3 sett fa", "2 sett fa", "Oggi"] as const;

const COACH_INSIGHT =
  "Il carico è aumentato gradualmente. Puoi procedere con il sovraccarico progressivo programmato per la seduta odierna.";

// =============================================================================
// AcwrGauge — semicircular SVG: track + 3 zone arcs + needle.
// =============================================================================
function AcwrGauge() {
  return (
    <div
      role="img"
      aria-label={`ACWR ${ACWR.ratio}, zona ${ACWR.zone}`}
      className="relative w-64 h-32 overflow-hidden"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 100 50"
        aria-hidden="true"
      >
        {/* Neutral track */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#e2e8f0"
          strokeLinecap="round"
          strokeWidth="8"
        />
        {/* Risk (amber, low) */}
        <path
          d="M 10 50 A 40 40 0 0 1 35 15"
          fill="none"
          stroke="#f59e0b"
          strokeOpacity="0.4"
          strokeWidth="8"
        />
        {/* Sweet spot (green) */}
        <path
          d="M 35 15 A 40 40 0 0 1 75 22"
          fill="none"
          stroke="#10b981"
          strokeWidth="8"
        />
        {/* Danger (red, high) */}
        <path
          d="M 75 22 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#ef4444"
          strokeOpacity="0.4"
          strokeWidth="8"
        />
        {/* Needle — points just past center of sweet spot for 1.15 */}
        <line
          x1="50"
          y1="50"
          x2="60"
          y2="12"
          stroke="#001e2d"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle cx="50" cy="50" r="4" fill="#001e2d" />
      </svg>
    </div>
  );
}

// =============================================================================
// AcwrTrendChart — pure SVG: optimal zone band + trend path + marker.
// =============================================================================
function AcwrTrendChart() {
  return (
    <div className="relative h-48 w-full mt-2">
      {/* Optimal zone band */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[30%] h-[35%] bg-emerald-500/10 rounded-md"
      >
        <span className="absolute right-2 top-1 font-sans text-[10px] font-bold tracking-wider uppercase text-emerald-600">
          Optimal Zone
        </span>
      </div>

      {/* Horizontal grid lines */}
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col justify-between border-b border-l border-[#c0c7d0]/40"
      >
        <div className="w-full border-t border-[#c0c7d0]/20 h-0" />
        <div className="w-full border-t border-[#c0c7d0]/20 h-0" />
        <div className="w-full border-t border-[#c0c7d0]/20 h-0" />
      </div>

      {/* SVG trend path + current-point glow */}
      <svg
        className="absolute inset-0 w-full h-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M 0 65 Q 15 55, 25 48 T 50 42 T 75 45 T 100 40"
          fill="none"
          stroke="#226fa3"
          strokeLinecap="round"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="100" cy="40" r="4" fill="#001e2d" />
        <circle cx="100" cy="40" r="8" fill="#001e2d" opacity="0.2" />
      </svg>
    </div>
  );
}

// =============================================================================
// AcwrAnalysis — page composition.
// =============================================================================
export default function AcwrAnalysis() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-surface text-on-surface font-sans antialiased">
      {/* Top bar */}
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-40",
          "h-16 flex items-center justify-between px-4",
          "backdrop-blur-lg bg-white/70",
          "border-b border-[#c0c7d0]/30",
          "shadow-sm shadow-slate-200/10",
        )}
      >
        <button
          type="button"
          onClick={() => navigate("/athlete/analytics")}
          aria-label="Torna alle metriche"
          className="h-10 w-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container/60 transition-colors active:scale-95"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </button>
        <h1 className="font-display text-lg font-bold tracking-tight text-on-surface">
          Carico di Lavoro (ACWR)
        </h1>
        <button
          type="button"
          aria-label="Informazioni ACWR"
          className="h-10 w-10 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container/60 transition-colors active:scale-95"
        >
          <Info className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      <main className="pt-24 pb-12 px-5 max-w-2xl mx-auto flex flex-col gap-6">
        {/* Hero gauge */}
        <section className="flex flex-col items-center py-6">
          <AcwrGauge />
          <div className="text-center mt-4">
            <span className="font-display text-5xl font-bold leading-none text-on-surface block">
              {ACWR.ratio}
            </span>
            <div className="mt-4">
              <span className="inline-flex items-center px-4 py-1 rounded-full bg-emerald-500/15 text-emerald-700 font-sans text-[11px] font-semibold tracking-wide">
                {ACWR.zone}
              </span>
            </div>
            <p className="mt-4 text-sm text-on-surface-variant max-w-xs mx-auto">
              {ACWR.zoneCaption}
            </p>
          </div>
        </section>

        {/* Breakdown */}
        <section
          aria-label="Dettaglio carico acuto vs cronico"
          className={cn(
            "rounded-3xl p-6",
            "bg-white/70 backdrop-blur-xl border border-[#c0c7d0]/30",
            "shadow-[0_10px_30px_rgba(80,118,142,0.05)]",
            "flex items-center",
          )}
        >
          <div className="flex-1 text-center">
            <p className="font-sans text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant mb-1">
              Carico Acuto (7 giorni)
            </p>
            <p className="font-display text-2xl font-bold tabular-nums text-on-surface">
              {ACWR.acuteKg.toLocaleString("it-IT")} kg
            </p>
          </div>
          <div aria-hidden="true" className="w-px h-12 bg-[#c0c7d0]/40 mx-4" />
          <div className="flex-1 text-center">
            <p className="font-sans text-[11px] font-semibold tracking-wider uppercase text-on-surface-variant mb-1">
              Carico Cronico (28 giorni)
            </p>
            <p className="font-display text-2xl font-bold tabular-nums text-on-surface">
              {ACWR.chronicKg.toLocaleString("it-IT")} kg
            </p>
          </div>
        </section>

        {/* Trend */}
        <section
          aria-label="Trend di affaticamento"
          className={cn(
            "rounded-3xl p-6",
            "bg-white/70 backdrop-blur-xl border border-[#c0c7d0]/30",
            "shadow-[0_10px_30px_rgba(80,118,142,0.05)]",
          )}
        >
          <h3 className="font-display text-xl font-semibold text-on-surface mb-2">
            Trend di Affaticamento
          </h3>
          <AcwrTrendChart />
          <div className="flex justify-between mt-4 text-on-surface-variant font-sans text-[10px] font-semibold tracking-wider uppercase">
            {TREND_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </section>

        {/* Coach insight */}
        <section
          aria-label="Coach insight"
          className={cn(
            "rounded-3xl p-5 flex gap-3 items-start",
            "bg-surface-container/60",
            "border-l-4 border-brand-container",
            "shadow-sm",
          )}
        >
          <Lightbulb
            className="h-5 w-5 text-brand-container mt-0.5 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-on-surface">
            <span className="font-bold">Insight:</span> {COACH_INSIGHT}
          </p>
        </section>

        {/* Context image — replaced with a clean placeholder div per brief */}
        <section className="rounded-3xl overflow-hidden h-40 relative bg-surface-container-high">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-brand-container/15 via-surface-variant/30 to-brand-container/20 flex items-center justify-center"
          >
            <Dumbbell
              className="h-10 w-10 text-brand-container/40"
              strokeWidth={1.5}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-on-surface/70 to-transparent flex items-end p-5">
            <span className="text-white font-display text-base font-semibold">
              Gestione del Recupero
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
