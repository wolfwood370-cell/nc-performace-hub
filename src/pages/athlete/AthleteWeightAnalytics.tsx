import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MoreVertical, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useAthleteWeightHistory } from "@/hooks/useAthleteWeightHistory";
import {
  computeWeightTrend,
  sliceByFilter,
  trendAtDaysAgo,
  type WeightFilter,
} from "@/lib/math/biometrics";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const TIME_FILTERS: WeightFilter[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];

const formatKg = (v: number | null | undefined) =>
  v == null ? "—" : `${v >= 0 ? "" : ""}${v.toFixed(1)} kg`;

const formatDelta = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)} kg`;

const DeltaIcon = ({ value }: { value: number | null }) => {
  if (value == null || Math.abs(value) < 0.05) return <Minus size={16} />;
  return value < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />;
};

const AthleteWeightAnalytics = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<WeightFilter>("3M");

  const { data: history = [], isLoading } = useAthleteWeightHistory();

  // Build the EWMA trend over the FULL dataset, then slice for display so that
  // the trend line at the start of the visible window remains continuous.
  const fullTrend = useMemo(() => computeWeightTrend(history), [history]);
  const visible = useMemo(
    () => sliceByFilter(fullTrend, activeFilter),
    [fullTrend, activeFilter],
  );

  const chartData = useMemo(
    () =>
      visible.map((p) => ({
        date: p.date,
        scale: p.scale,
        trend: p.trend,
        label: format(parseISO(p.date), "d MMM", { locale: it }),
      })),
    [visible],
  );

  const currentTrend = visible.length ? visible[visible.length - 1].trend : null;
  const startTrend = visible.length ? visible[0].trend : null;
  const periodDelta =
    currentTrend != null && startTrend != null ? currentTrend - startTrend : null;

  const dateRange = useMemo(() => {
    if (visible.length < 2) return "";
    const first = format(parseISO(visible[0].date), "d MMM", { locale: it });
    const last = format(parseISO(visible[visible.length - 1].date), "d MMM yyyy", { locale: it });
    return `${first} - ${last}`;
  }, [visible]);

  const changes = useMemo(() => {
    const points = [
      { label: "3 Giorni", days: 3 },
      { label: "7 Giorni", days: 7 },
      { label: "30 Giorni", days: 30 },
    ];
    return points.map((p) => {
      if (currentTrend == null) return { ...p, delta: null as number | null };
      const past = trendAtDaysAgo(fullTrend, p.days);
      return {
        ...p,
        delta: past == null ? null : Number((currentTrend - past).toFixed(2)),
      };
    });
  }, [fullTrend, currentTrend]);

  if (isLoading) return <LoadingSpinner />;

  const deltaColorClass =
    periodDelta == null
      ? "text-secondary"
      : periodDelta < 0
        ? "text-secondary"
        : "text-on-surface";

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
              {currentTrend != null ? currentTrend.toFixed(1) : "—"}
            </span>
            <span className="text-on-surface-variant">kg</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className={`bg-surface-container flex items-center gap-1 px-3 py-1 rounded-full ${deltaColorClass}`}>
              <DeltaIcon value={periodDelta} />
              <span className="font-semibold text-xs">{formatDelta(periodDelta)}</span>
            </div>
          </div>
          {dateRange && <p className="text-sm text-outline mt-3">{dateRange}</p>}
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
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-on-surface-variant">
                Nessun dato peso registrato in questo intervallo.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid
                    stroke="hsl(var(--surface-variant))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="label" hide />
                  <YAxis hide domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--surface))",
                      border: "1px solid hsl(var(--surface-variant))",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                    labelFormatter={(v) => String(v)}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)} kg`,
                      name === "scale" ? "Peso Bilancia" : "Trend Calcolato",
                    ]}
                  />
                  <Line
                    type="linear"
                    dataKey="scale"
                    stroke="hsl(var(--outline-variant))"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke="hsl(var(--primary))"
                    strokeWidth={4}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-surface-variant/50">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-outline-variant" />
              <span className="text-xs text-on-surface-variant">Peso Bilancia</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-xs text-on-surface-variant">Trend Calcolato</span>
            </div>
          </div>
        </div>

        {/* 6. Insights Card */}
        <div className="bg-white border border-surface-variant/50 rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-primary mb-6">
            Cambiamenti Peso
          </h2>
          <div className="flex flex-col">
            {changes.map((row, idx) => {
              const colorClass =
                row.delta == null
                  ? "text-on-surface-variant"
                  : row.delta < 0
                    ? "text-secondary"
                    : "text-on-surface";
              return (
                <div
                  key={row.label}
                  className={
                    "flex justify-between items-center py-3" +
                    (idx < changes.length - 1
                      ? " border-b border-surface-variant/50"
                      : "")
                  }
                >
                  <span className="text-on-surface font-medium">{row.label}</span>
                  <div className={`flex items-center gap-1 ${colorClass}`}>
                    <DeltaIcon value={row.delta} />
                    <span className="font-bold">{formatDelta(row.delta)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AthleteWeightAnalytics;
