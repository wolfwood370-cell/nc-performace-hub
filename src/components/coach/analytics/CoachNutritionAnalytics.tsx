import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoachNutritionAnalytics } from "@/hooks/useCoachNutritionAnalytics";
import { Activity, Scale, Target, Sparkles, Utensils } from "lucide-react";
import { toast } from "sonner";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface CoachNutritionAnalyticsProps {
  athleteId: string | undefined;
}

function adherenceColor(pct: number): string {
  if (pct > 90) return "text-emerald-600";
  if (pct > 75) return "text-amber-600";
  return "text-rose-600";
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600 [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
      </div>
      <div className={cn("mt-2 text-2xl font-bold tabular-nums text-slate-900", valueClass)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

// Local shape for the recharts tooltip payload entries we care about.
// `dataKey` discriminates which series the point belongs to; `value` and
// the per-point `payload` carry the actual numbers.
type TooltipPoint = {
  dataKey: string;
  value: number | null;
  payload?: { targetCalories?: number | null };
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPoint[];
  label?: string;
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const logged = payload.find((p) => p.dataKey === "loggedCalories")?.value;
  const weight = payload.find((p) => p.dataKey === "weight")?.value;
  const target = payload[0]?.payload?.targetCalories;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <div className="mt-1 space-y-0.5 text-xs">
        {logged != null && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm bg-sky-500" />
            <span className="text-slate-500">Calorie:</span>
            <span className="font-medium tabular-nums text-slate-900">{logged} kcal</span>
          </div>
        )}
        {target != null && (
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-2 bg-slate-400" />
            <span className="text-slate-500">Target:</span>
            <span className="font-medium tabular-nums text-slate-900">{target} kcal</span>
          </div>
        )}
        {weight != null && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-slate-500">Peso:</span>
            <span className="font-medium tabular-nums text-slate-900">{weight} kg</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CoachNutritionAnalytics({ athleteId }: CoachNutritionAnalyticsProps) {
  const { data, isLoading } = useCoachNutritionAnalytics(athleteId);

  const handleRecalculate = () => {
    toast.info("Apertura wizard calcolo...");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-[340px] w-full" />
      </div>
    );
  }

  const adherence = data?.adherencePct ?? 0;
  const avgDelta = data?.avgDelta ?? 0;
  const weightChange = data?.weightChange;
  const target = data?.targetCalories;
  const weightVals = (data?.data ?? []).map((d) => d.weight).filter((v): v is number => v != null);
  const minWeight = weightVals.length ? Math.min(...weightVals) - 1 : 0;
  const maxWeight = weightVals.length ? Math.max(...weightVals) + 1 : 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
            <Utensils className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Analisi Nutrizionale</h3>
            <p className="text-xs text-slate-500">Aderenza e trend peso (30 giorni)</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleRecalculate}
          className="bg-sky-600 hover:bg-sky-700 text-white"
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Ricalcola Strategia
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label="Aderenza Macro (30g)"
          value={`${adherence}%`}
          hint="Giorni entro ±5% del target"
          icon={<Target />}
          valueClass={adherenceColor(adherence)}
        />
        <KpiCard
          label="Deficit/Surplus Medio"
          value={target == null ? "—" : `${avgDelta > 0 ? "+" : ""}${avgDelta} kcal`}
          hint={target ? `Target: ${target} kcal/g` : "Nessun target attivo"}
          icon={<Activity />}
          valueClass={
            avgDelta < 0 ? "text-sky-600" : avgDelta > 0 ? "text-amber-600" : "text-slate-900"
          }
        />
        <KpiCard
          label="Variazione Peso (30g)"
          value={weightChange == null ? "—" : `${weightChange > 0 ? "+" : ""}${weightChange} kg`}
          hint={weightChange == null ? "Dati insufficienti" : "Prima vs ultima misura"}
          icon={<Scale />}
          valueClass={
            weightChange == null
              ? "text-slate-400"
              : weightChange < 0
                ? "text-emerald-600"
                : weightChange > 0
                  ? "text-amber-600"
                  : "text-slate-900"
          }
        />
      </div>

      {/* Chart */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-900">
            Calorie Registrate vs Peso Corporeo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.hasData ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Utensils className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">
                Nessun dato nutrizionale negli ultimi 30 giorni
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={data.data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="dateFormatted"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="cal"
                  orientation="left"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  label={{
                    value: "kcal",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "#64748b",
                  }}
                />
                <YAxis
                  yAxisId="weight"
                  orientation="right"
                  domain={[minWeight, maxWeight]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  label={{
                    value: "kg",
                    angle: 90,
                    position: "insideRight",
                    fontSize: 11,
                    fill: "#64748b",
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {target != null && (
                  <ReferenceLine
                    yAxisId="cal"
                    y={target}
                    stroke="#94a3b8"
                    strokeDasharray="5 5"
                    label={{
                      value: `Target ${target}`,
                      position: "right",
                      fontSize: 10,
                      fill: "#64748b",
                    }}
                  />
                )}
                <Bar
                  yAxisId="cal"
                  dataKey="loggedCalories"
                  name="Calorie Registrate"
                  fill="#0ea5e9"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="weight"
                  type="monotone"
                  dataKey="weight"
                  name="Peso (kg)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ fill: "#f59e0b", r: 3 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CoachNutritionAnalytics;
