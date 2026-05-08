import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MoreVertical, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type TimeFilter = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

const TIME_FILTERS: TimeFilter[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];

// Dummy data illustrating jagged scale weight vs smooth trend curve
const CHART_DATA = [
  { day: 1, scale: 115.3, trend: 115.3 },
  { day: 5, scale: 116.1, trend: 115.2 },
  { day: 10, scale: 114.8, trend: 115.0 },
  { day: 15, scale: 115.6, trend: 114.85 },
  { day: 20, scale: 114.2, trend: 114.7 },
  { day: 25, scale: 115.0, trend: 114.55 },
  { day: 30, scale: 113.9, trend: 114.4 },
  { day: 40, scale: 114.5, trend: 114.2 },
  { day: 50, scale: 113.7, trend: 114.0 },
  { day: 60, scale: 114.1, trend: 113.85 },
  { day: 70, scale: 113.5, trend: 113.7 },
  { day: 80, scale: 114.0, trend: 113.55 },
  { day: 90, scale: 113.2, trend: 113.4 },
];

const WEIGHT_CHANGES = [
  { label: "3 Giorni", delta: "-0.2 kg" },
  { label: "7 Giorni", delta: "-0.5 kg" },
  { label: "30 Giorni", delta: "-1.8 kg" },
];

const AthleteWeightAnalytics = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<TimeFilter>("3M");

  const data = useMemo(() => CHART_DATA, []);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* 1. Top App Bar */}
      <header className="sticky top-0 z-50 border-b border-surface-variant/50 shadow-sm bg-white/80 backdrop-blur-xl">
        <div className="flex justify-between items-center w-full px-6 h-16 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="text-primary hover:bg-surface-variant p-2 rounded-full transition-colors"
            aria-label="Torna indietro"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display font-semibold text-lg text-primary tracking-tight">
            Analisi Peso
          </h1>
          <button
            className="text-primary hover:bg-surface-variant p-2 rounded-full transition-colors"
            aria-label="Altre opzioni"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="pt-6 px-6 max-w-lg mx-auto flex flex-col gap-6 pb-12">
        {/* 3. Hero Metric */}
        <section className="flex flex-col items-center justify-center text-center py-4">
          <span className="font-semibold text-[10px] text-outline uppercase tracking-widest block mb-2">
            Media Attuale
          </span>
          <div className="flex items-baseline justify-center gap-2">
            <span className="font-display text-5xl font-bold text-primary">
              114.2
            </span>
            <span className="text-on-surface-variant">kg</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="bg-surface-container flex items-center gap-1 px-3 py-1 rounded-full text-secondary">
              <TrendingDown size={16} />
              <span className="font-semibold text-xs">-1.1 kg</span>
            </div>
          </div>
          <p className="text-sm text-outline mt-3">2 Feb - 2 Mag 2026</p>
        </section>

        {/* 4. Time Filters */}
        <div className="flex flex-wrap justify-center gap-2 px-2">
          {TIME_FILTERS.map((filter) => {
            const isActive = filter === activeFilter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={
                  isActive
                    ? "px-5 py-2 rounded-full font-semibold text-sm bg-primary text-white shadow-sm transition-colors"
                    : "px-5 py-2 rounded-full font-semibold text-sm bg-surface-container-low border border-surface-variant text-on-surface-variant hover:bg-surface-container transition-colors"
                }
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* 5. Dual-Line Chart Card */}
        <div className="bg-white/80 backdrop-blur-xl border border-surface-variant/50 rounded-2xl p-6 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  stroke="hsl(var(--surface-variant))"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis dataKey="day" hide />
                <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--surface))",
                    border: "1px solid hsl(var(--surface-variant))",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  labelFormatter={(v) => `Giorno ${v}`}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)} kg`,
                    name === "scale" ? "Peso Bilancia" : "Trend Calcolato",
                  ]}
                />
                {/* Jagged scale weight */}
                <Line
                  type="linear"
                  dataKey="scale"
                  stroke="hsl(var(--outline-variant))"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Smooth trend curve */}
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke="hsl(var(--primary))"
                  strokeWidth={4}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-surface-variant/50">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-outline-variant" />
              <span className="text-xs text-on-surface-variant">
                Peso Bilancia
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-xs text-on-surface-variant">
                Trend Calcolato
              </span>
            </div>
          </div>
        </div>

        {/* 6. Insights Card */}
        <div className="bg-white border border-surface-variant/50 rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-primary mb-6">
            Cambiamenti Peso
          </h2>
          <div className="flex flex-col">
            {WEIGHT_CHANGES.map((row, idx) => (
              <div
                key={row.label}
                className={
                  "flex justify-between items-center py-3" +
                  (idx < WEIGHT_CHANGES.length - 1
                    ? " border-b border-surface-variant/50"
                    : "")
                }
              >
                <span className="text-on-surface font-medium">{row.label}</span>
                <div className="flex items-center gap-1 text-secondary">
                  <TrendingDown size={16} />
                  <span className="font-bold">{row.delta}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AthleteWeightAnalytics;
