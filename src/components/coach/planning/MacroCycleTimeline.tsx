// MacroCycleTimeline — Linear/Notion-inspired horizontal planning view
import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronLeft, ChevronRight, Layers, Pencil, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  differenceInDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isWithinInterval,
  isBefore,
  isAfter,
} from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useCoachTrainingBlocks } from "@/hooks/useCoachTrainingBlocks";

// ── Types ─────────────────────────────────────────────────────────────

// Re-exports the hook's TrainingBlock shape, with the legacy optional
// fields (`programId`, `notes`) kept for any future caller that passes
// blocks via prop.
interface TrainingBlock {
  id: string;
  name: string;
  focusType: string;
  startDate: Date;
  endDate: Date;
  athleteName?: string | null;
  athleteId?: string;
  programId?: string;
  notes?: string;
}

interface MacroCycleTimelineProps {
  /**
   * Override blocks. If omitted, the component fetches the current
   * coach's `training_phases` via `useCoachTrainingBlocks` (audit M3).
   */
  blocks?: TrainingBlock[];
  /** Number of months to show (default: 8) */
  monthsToShow?: number;
}

// ── Phase styling map ─────────────────────────────────────────────────

const PHASE_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  hypertrophy: {
    bg: "bg-violet-500/15",
    border: "border-violet-500/40",
    text: "text-violet-700 dark:text-violet-300",
    label: "Ipertrofia",
  },
  strength: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/40",
    text: "text-blue-700 dark:text-blue-300",
    label: "Forza",
  },
  power: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-700 dark:text-amber-300",
    label: "Potenza",
  },
  endurance: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Resistenza",
  },
  peaking: {
    bg: "bg-rose-500/15",
    border: "border-rose-500/40",
    text: "text-rose-700 dark:text-rose-300",
    label: "Peaking",
  },
  recovery: {
    bg: "bg-sky-500/15",
    border: "border-sky-500/40",
    text: "text-sky-700 dark:text-sky-300",
    label: "Recupero",
  },
  transition: {
    bg: "bg-slate-400/15",
    border: "border-slate-400/40",
    text: "text-slate-600 dark:text-slate-300",
    label: "Transizione",
  },
};

const getPhaseStyle = (focusType: string) => PHASE_STYLES[focusType] ?? PHASE_STYLES.transition;

// ── Component ─────────────────────────────────────────────────────────

export function MacroCycleTimeline({
  blocks: externalBlocks,
  monthsToShow = 8,
}: MacroCycleTimelineProps) {
  const navigate = useNavigate();
  const [selectedBlock, setSelectedBlock] = useState<TrainingBlock | null>(null);
  const [athleteFilter, setAthleteFilter] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Audit M3 closure: when no externalBlocks prop is passed, fetch from
  // `training_phases` via the dedicated hook instead of using mock data.
  const { blocks: fetchedBlocks, isLoading: blocksLoading } = useCoachTrainingBlocks();
  const blocks = externalBlocks ?? fetchedBlocks;

  // `now` was previously a module-level const tied to MOCK_BLOCKS. Now
  // computed per-render — re-computation is cheap and avoids stale dates
  // when the user keeps the tab open across day boundaries.
  const now = useMemo(() => new Date(), []);

  // Unique athlete list
  const athletes = useMemo(() => {
    const map = new Map<string, string>();
    blocks.forEach((b) => {
      if (b.athleteId && b.athleteName) map.set(b.athleteId, b.athleteName);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [blocks]);

  const filteredBlocks = useMemo(
    () => (athleteFilter === "all" ? blocks : blocks.filter((b) => b.athleteId === athleteFilter)),
    [blocks, athleteFilter],
  );

  // Timeline range
  const timelineStart = startOfMonth(now);
  const timelineEnd = endOfMonth(addMonths(now, monthsToShow - 1));

  const months = useMemo(
    () => eachMonthOfInterval({ start: timelineStart, end: timelineEnd }),
    [timelineStart, timelineEnd],
  );

  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
  const PX_PER_DAY = 4.5; // each day = 4.5px
  const totalWidth = totalDays * PX_PER_DAY;

  // Group blocks by athlete for row rendering
  const rows = useMemo(() => {
    const grouped = new Map<string, TrainingBlock[]>();
    filteredBlocks.forEach((b) => {
      const key = b.athleteId ?? "unassigned";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(b);
    });
    return Array.from(grouped, ([athleteId, rowBlocks]) => ({
      athleteId,
      athleteName: rowBlocks[0]?.athleteName ?? "Unassigned",
      blocks: rowBlocks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    }));
  }, [filteredBlocks]);

  // Helper: position a block on the timeline
  const getBlockStyle = (block: TrainingBlock) => {
    const clampedStart = isBefore(block.startDate, timelineStart) ? timelineStart : block.startDate;
    const clampedEnd = isAfter(block.endDate, timelineEnd) ? timelineEnd : block.endDate;

    const leftDays = differenceInDays(clampedStart, timelineStart);
    const widthDays = differenceInDays(clampedEnd, clampedStart) + 1;

    return {
      left: leftDays * PX_PER_DAY,
      width: Math.max(widthDays * PX_PER_DAY, 40), // min 40px
    };
  };

  const isToday = (month: Date) => {
    return month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear();
  };

  const todayOffset = differenceInDays(now, timelineStart) * PX_PER_DAY;

  // Loading state — only show when we fetched via the hook (no
  // externalBlocks prop) and the query is still in flight.
  if (!externalBlocks && blocksLoading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 pt-4 px-4 lg:px-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Layers className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Macro-Ciclo</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Pianificazione periodizzazione •{" "}
                  {format(timelineStart, "MMM yyyy", { locale: it })} –{" "}
                  {format(timelineEnd, "MMM yyyy", { locale: it })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {athletes.length > 1 && (
                <Select value={athleteFilter} onValueChange={setAthleteFilter}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="Tutti gli atleti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli atleti</SelectItem>
                    {athletes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Legend */}
              <div className="hidden md:flex items-center gap-1.5 ml-2">
                {Object.entries(PHASE_STYLES)
                  .slice(0, 5)
                  .map(([key, style]) => (
                    <div key={key} className="flex items-center gap-1" title={style.label}>
                      <div
                        className={cn("h-2.5 w-2.5 rounded-sm border", style.bg, style.border)}
                      />
                      <span className="text-3xs text-muted-foreground">{style.label}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="w-full" ref={scrollRef}>
            <div style={{ width: totalWidth, minWidth: "100%" }}>
              {/* Month headers */}
              <div className="flex border-b border-border/50 sticky top-0 bg-card z-10">
                {months.map((month, i) => {
                  const monthStart = startOfMonth(month);
                  const monthEnd = endOfMonth(month);
                  const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
                  const w = daysInMonth * PX_PER_DAY;

                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-shrink-0 px-2 py-2 text-xs font-medium border-r border-border/30",
                        isToday(month)
                          ? "text-primary font-semibold bg-primary/5"
                          : "text-muted-foreground",
                      )}
                      style={{ width: w }}
                    >
                      {format(month, "MMM yyyy", { locale: it })}
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              {rows.map((row) => (
                <div key={row.athleteId} className="relative border-b border-border/20">
                  {/* Athlete label */}
                  <div className="sticky left-0 z-20 inline-flex items-center gap-1.5 px-3 py-1 bg-card/90 backdrop-blur-sm">
                    <span className="text-2xs font-semibold text-muted-foreground truncate max-w-[100px]">
                      {row.athleteName}
                    </span>
                  </div>

                  {/* Blocks track */}
                  <div className="relative h-12 -mt-5">
                    {/* Today marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-primary/50 z-10"
                      style={{ left: todayOffset }}
                    >
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 text-4xs font-bold text-primary bg-primary/10 px-1 rounded-b">
                        Oggi
                      </div>
                    </div>

                    {row.blocks.map((block) => {
                      const pos = getBlockStyle(block);
                      const style = getPhaseStyle(block.focusType);
                      const weeks = Math.round(
                        differenceInDays(block.endDate, block.startDate) / 7,
                      );

                      return (
                        <button
                          key={block.id}
                          className={cn(
                            "absolute top-2 h-8 rounded-md border cursor-pointer",
                            "flex items-center gap-1.5 px-2 overflow-hidden",
                            "transition-all hover:scale-[1.02] hover:shadow-md hover:z-30",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            style.bg,
                            style.border,
                          )}
                          style={{
                            left: pos.left,
                            width: pos.width,
                          }}
                          onClick={() => setSelectedBlock(block)}
                          title={`${block.name} — ${weeks}w`}
                        >
                          <span
                            className={cn(
                              "text-3xs font-semibold truncate leading-none",
                              style.text,
                            )}
                          >
                            {block.name}
                          </span>
                          {pos.width > 90 && (
                            <span className="text-4xs text-muted-foreground/70 flex-shrink-0">
                              {weeks}w
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Empty state */}
              {rows.length === 0 && (
                <div className="py-12 text-center">
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nessun blocco di allenamento pianificato
                  </p>
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Block Detail Drawer */}
      <Sheet open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}>
        <SheetContent className="sm:max-w-md">
          {selectedBlock && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-sm border",
                      getPhaseStyle(selectedBlock.focusType).bg,
                      getPhaseStyle(selectedBlock.focusType).border,
                    )}
                  />
                  {selectedBlock.name}
                </SheetTitle>
                <SheetDescription>
                  {selectedBlock.athleteName
                    ? `Atleta: ${selectedBlock.athleteName}`
                    : "Blocco di allenamento"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Phase badge */}
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "border",
                      getPhaseStyle(selectedBlock.focusType).bg,
                      getPhaseStyle(selectedBlock.focusType).border,
                      getPhaseStyle(selectedBlock.focusType).text,
                    )}
                  >
                    {getPhaseStyle(selectedBlock.focusType).label}
                  </Badge>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-2xs font-medium">Inizio</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {format(selectedBlock.startDate, "d MMM yyyy", {
                        locale: it,
                      })}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-2xs font-medium">Fine</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {format(selectedBlock.endDate, "d MMM yyyy", {
                        locale: it,
                      })}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-2xs font-medium">Durata</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {Math.round(
                        differenceInDays(selectedBlock.endDate, selectedBlock.startDate) / 7,
                      )}{" "}
                      Settimane
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Target className="h-3.5 w-3.5" />
                      <span className="text-2xs font-medium">Focus</span>
                    </div>
                    <p className="text-sm font-semibold capitalize">
                      {getPhaseStyle(selectedBlock.focusType).label}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {selectedBlock.notes && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Note</p>
                    <p className="text-sm">{selectedBlock.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (selectedBlock.programId) {
                        navigate(`/coach/program-builder/${selectedBlock.programId}`);
                      } else {
                        navigate("/coach/program-builder");
                      }
                      setSelectedBlock(null);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Apri nel Program Builder
                  </Button>
                  {selectedBlock.athleteId && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        navigate(`/coach/athlete/${selectedBlock.athleteId}`);
                        setSelectedBlock(null);
                      }}
                    >
                      Vai al Profilo Atleta
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
