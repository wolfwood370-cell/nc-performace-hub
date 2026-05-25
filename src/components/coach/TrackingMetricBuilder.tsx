import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, X, GripVertical } from "lucide-react";

// Available tracking metrics
const TRACKING_METRICS = [
  { value: "sets", label: "Serie (Sets)" },
  { value: "rounds", label: "Round" },
  { value: "reps", label: "Reps" },
  { value: "weight", label: "Carico (Kg)" },
  { value: "rpe", label: "RPE" },
  { value: "duration", label: "Durata (mm:ss)" },
  { value: "distance", label: "Distanza (m/km)" },
  { value: "rest", label: "Riposo (mm:ss)" },
  { value: "tempo", label: "TEMPO (xxxx)" },
] as const;

type TrackingMetricValue = (typeof TRACKING_METRICS)[number]["value"];

interface TrackingMetricBuilderProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function TrackingMetricBuilder({ value, onChange }: TrackingMetricBuilderProps) {
  const selectedMetrics = value;

  const addMetric = (metricValue: string) => {
    if (selectedMetrics.includes(metricValue)) return;
    onChange([...selectedMetrics, metricValue]);
  };

  const removeMetric = (metricValue: string) => {
    onChange(selectedMetrics.filter((m) => m !== metricValue));
  };

  const moveMetric = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedMetrics.length) return;

    const newMetrics = [...selectedMetrics];
    const temp = newMetrics[index];
    newMetrics[index] = newMetrics[newIndex];
    newMetrics[newIndex] = temp;
    onChange(newMetrics);
  };

  const getLabel = (metricValue: string) => {
    return TRACKING_METRICS.find((m) => m.value === metricValue)?.label || metricValue;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Metriche di Tracking</Label>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {selectedMetrics.length} Selezionate
        </span>
      </div>

      {/* Available Metrics */}
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          Metriche Disponibili
        </span>
        <div className="flex flex-wrap gap-2">
          {TRACKING_METRICS.map((metric) => {
            const isSelected = selectedMetrics.includes(metric.value);

            return (
              <Badge
                key={metric.value}
                variant={isSelected ? "secondary" : "outline"}
                className={cn(
                  "cursor-pointer transition-all select-none",
                  isSelected
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                )}
                onClick={() => !isSelected && addMetric(metric.value)}
              >
                {metric.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Selected Metrics */}
      <div className="space-y-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          Configurazione Attiva (in ordine)
        </span>
        {selectedMetrics.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Clicca sulle metriche sopra per aggiungerle
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-1.5 pr-3">
              {selectedMetrics.map((metricValue, index) => (
                <div
                  key={metricValue}
                  className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 border border-border"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground w-5 flex-shrink-0">
                    {index + 1}.
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">
                    {getLabel(metricValue)}
                  </span>

                  {/* Move buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Sposta su"
                      className="h-7 w-7"
                      onClick={() => moveMetric(index, "up")}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Sposta giù"
                      className="h-7 w-7"
                      onClick={() => moveMetric(index, "down")}
                      disabled={index === selectedMetrics.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Remove button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Rimuovi metrica"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => removeMetric(metricValue)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        L'ordine delle metriche determinerà come verranno visualizzate durante il log
        dell'allenamento.
      </p>
    </div>
  );
}
