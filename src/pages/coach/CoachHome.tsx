/**
 * src/pages/coach/CoachHome.tsx
 * ---------------------------------------------------------------------------
 * Coach "Command Center" — Bento Grid Dashboard (Aura Health System).
 *
 * Layout: grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6.
 *
 * Five widgets:
 *   1. AI Copilot Insight   — greeting + auto-generated daily insight (full top width)
 *   2. Triage / Risk Alerts — athletes flagged by ACWR / readiness / RPE
 *   3. Today's Pulse        — workouts completed today vs scheduled (gauge)
 *   4. Recent Completions   — scrollable list of finished workouts (RPE + view CTA)
 *   5. Quick Actions        — pill-shaped shortcuts (invite, program, calendar, messages)
 *
 * Hooks reused 1:1 from the previous dashboard:
 *   - useCoachDashboardMetrics → urgentAlerts, feedbackItems, todaySchedule,
 *     businessMetrics, healthyAthletes, isLoading
 *   - useCoachAlerts → smart watchdog alerts
 *   - useAuth → user, profile, auth loading state
 *
 * Aura design rules enforced:
 *   - All widget cards: rounded-3xl bg-surface-container-lowest
 *     shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-outline-variant/20 p-6
 *   - Buttons: pill-shaped (inherited from <Button>)
 *   - Icons: lucide-react only
 *   - Typography: font-display for headlines, font-sans for body
 */
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { CoachLayout } from "@/components/coach/CoachLayout";
import { MetaHead } from "@/components/MetaHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InviteAthleteDialog } from "@/components/coach/InviteAthleteDialog";

import { useAuth } from "@/hooks/useAuth";
import {
  useCoachDashboardMetrics,
  type UrgentAlert,
  type AlertType,
  type AlertSeverity,
} from "@/hooks/useCoachDashboardMetrics";
import { useCoachAlerts } from "@/hooks/useCoachAlerts";

import {
  Sparkles,
  ShieldAlert,
  Activity,
  CheckCircle2,
  UserPlus,
  ChevronRight,
  Calendar,
  MessageSquare,
  Flame,
  AlertCircle,
  Battery,
  CalendarX,
  Clock,
  Zap,
  Dumbbell,
  PlusCircle,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Aura card class — single source of truth for widget surfaces.
// Inlined shadow guarantees no Tailwind preset can override the soft ambient.
// ---------------------------------------------------------------------------
const auraCard =
  "rounded-3xl bg-surface-container-lowest border border-outline-variant/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6";

// ---------------------------------------------------------------------------
// Helpers (re-used by Triage widget)
// ---------------------------------------------------------------------------
const getAlertConfig = (type: AlertType) => {
  const configs: Record<
    AlertType,
    { icon: typeof AlertTriangle; label: string; bgClass: string; textClass: string }
  > = {
    missed_workout: {
      icon: CalendarX,
      label: "Allenamento saltato",
      bgClass: "bg-destructive/10",
      textClass: "text-destructive",
    },
    low_readiness: {
      icon: Battery,
      label: "Readiness bassa",
      bgClass: "bg-destructive/10",
      textClass: "text-destructive",
    },
    active_injury: {
      icon: AlertCircle,
      label: "Infortunio attivo",
      bgClass: "bg-destructive/10",
      textClass: "text-destructive",
    },
    high_acwr: {
      icon: Flame,
      label: "ACWR > 1.5",
      bgClass: "bg-warning/10",
      textClass: "text-warning",
    },
    rpe_spike: {
      icon: Zap,
      label: "RPE elevato",
      bgClass: "bg-warning/10",
      textClass: "text-warning",
    },
    no_checkin: {
      icon: Clock,
      label: "Nessun check-in",
      bgClass: "bg-muted",
      textClass: "text-muted-foreground",
    },
  };
  return (
    configs[type] ?? {
      icon: AlertTriangle,
      label: "Alert",
      bgClass: "bg-muted",
      textClass: "text-muted-foreground",
    }
  );
};

const getSeverityBadge = (severity: AlertSeverity): string => {
  switch (severity) {
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "warning":
      return "bg-warning/10 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-outline-variant/40";
  }
};

// ===========================================================================
// Page
// ===========================================================================
export default function CoachHome() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { urgentAlerts, feedbackItems, todaySchedule, businessMetrics, isLoading } =
    useCoachDashboardMetrics();
  const { alerts: smartAlerts } = useCoachAlerts();

  // ── Auth guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  // ── Derived state ───────────────────────────────────────────────────────
  const firstName = profile?.full_name?.split(" ")[0] ?? "Coach";
  const hasAthletes = businessMetrics.activeClients > 0;

  // Triage = critical + warning urgent alerts, capped at 5 for layout calmness.
  const triageAlerts = useMemo(
    () =>
      urgentAlerts.filter((a) => a.severity === "critical" || a.severity === "warning").slice(0, 5),
    [urgentAlerts],
  );

  // Today's pulse — workouts completed today vs scheduled today.
  // `feedbackItems` is the "needs review" backlog (=completed but unreviewed),
  // so its count is a fair proxy for "trained today" until we have a dedicated
  // hook. The denominator is the day's schedule length.
  const completedToday = feedbackItems.length;
  const scheduledToday = todaySchedule.length;
  const pulsePct =
    scheduledToday > 0
      ? Math.min(100, Math.round((completedToday / scheduledToday) * 100))
      : completedToday > 0
        ? 100
        : 0;

  // AI Copilot insight — synthesized from the live metrics. No remote AI call;
  // this is a deterministic, single-sentence "headline" so the widget never
  // shows an empty stub.
  const aiInsight = useMemo(() => {
    if (!hasAthletes) return "Invita il tuo primo atleta per attivare gli insight quotidiani.";
    const bits: string[] = [];
    if (triageAlerts.length > 0) {
      const first = triageAlerts[0];
      bits.push(
        `${first.athleteName} ha un alert ${first.severity === "critical" ? "critico" : "di attenzione"}`,
      );
    }
    if (feedbackItems.length > 0) {
      bits.push(
        `${feedbackItems.length} workout ${feedbackItems.length === 1 ? "attende" : "attendono"} il tuo feedback`,
      );
    }
    if (scheduledToday > 0) {
      bits.push(`${scheduledToday} sessioni programmate per oggi`);
    }
    if (bits.length === 0) {
      return "Tutto sotto controllo. Nessun alert critico, nessuna sessione in sospeso.";
    }
    return bits.slice(0, 3).join(" · ") + ".";
  }, [hasAthletes, triageAlerts, feedbackItems.length, scheduledToday]);

  // ── Loading + empty states ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <CoachLayout title="Command Center" subtitle="Caricamento...">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
          <Skeleton className="md:col-span-3 xl:col-span-4 h-40 rounded-3xl" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
      </CoachLayout>
    );
  }

  if (!isLoading && !hasAthletes) {
    return (
      <>
        <MetaHead title="Command Center" description="Dashboard del coach." />
        <CoachLayout title="Command Center" subtitle="Inizia con il tuo primo atleta">
          <div className={cn(auraCard, "p-12 text-center max-w-2xl mx-auto")}>
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/20 to-secondary/40 mb-6 ring-4 ring-primary/10">
              <UserPlus className="h-10 w-10 text-primary" strokeWidth={1.75} />
            </div>
            <h3 className="font-display text-2xl font-bold text-foreground mb-2">
              Benvenuto, {firstName}!
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Invita il tuo primo atleta per attivare il Command Center: triage automatico, pulse
              giornaliero e insight AI in tempo reale.
            </p>
            <InviteAthleteDialog
              trigger={
                <Button size="lg" className="gap-2">
                  <UserPlus className="h-5 w-5" />
                  Invita il primo atleta
                </Button>
              }
            />
          </div>
        </CoachLayout>
      </>
    );
  }

  // ── Bento grid ──────────────────────────────────────────────────────────
  return (
    <>
      <MetaHead title="Command Center" description="Dashboard del coach." />
      <CoachLayout
        title="Command Center"
        subtitle={format(new Date(), "EEEE d MMMM yyyy", { locale: it })}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
          {/* ═══ Widget 1: AI Copilot Insight ═══ */}
          <AiCopilotWidget
            firstName={firstName}
            insight={aiInsight}
            alertCount={triageAlerts.length}
          />

          {/* ═══ Widget 2: Triage / Risk Alerts ═══ */}
          <TriageWidget
            alerts={triageAlerts}
            smartCount={smartAlerts.length}
            isLoading={isLoading}
            onSelect={(id) => navigate(`/coach/athlete/${id}`)}
          />

          {/* ═══ Widget 3: Today's Pulse ═══ */}
          <PulseWidget
            completed={completedToday}
            scheduled={scheduledToday}
            percentage={pulsePct}
            isLoading={isLoading}
          />

          {/* ═══ Widget 4: Recent Completions ═══ */}
          <RecentCompletionsWidget
            items={feedbackItems}
            isLoading={isLoading}
            onView={(id) => navigate(`/coach/athlete/${id}`)}
          />

          {/* ═══ Widget 5: Quick Actions ═══ */}
          <QuickActionsWidget onNavigate={navigate} />
        </div>
      </CoachLayout>
    </>
  );
}

// ===========================================================================
// Widget 1 — AI Copilot Insight (full top row)
// ===========================================================================
function AiCopilotWidget({
  firstName,
  insight,
  alertCount,
}: {
  firstName: string;
  insight: string;
  alertCount: number;
}) {
  return (
    <div
      className={cn(
        // Gradient + glass — extra ambient lift over the standard auraCard.
        "md:col-span-3 xl:col-span-4 relative overflow-hidden rounded-3xl border border-outline-variant/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 md:p-8",
        "bg-gradient-to-br from-primary/10 via-secondary/30 to-surface-container-lowest",
      )}
    >
      {/* Decorative aura blob */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secondary/40 blur-3xl" />

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/15 ring-1 ring-primary/20 flex-shrink-0">
            <Sparkles className="h-6 w-6 text-primary" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Buongiorno, {firstName}
            </p>
            <p className="text-sm md:text-base text-on-surface-variant mt-1 font-sans leading-relaxed">
              {insight}
            </p>
          </div>
        </div>
        {alertCount > 0 && (
          <Badge
            variant="outline"
            className="self-start md:self-center bg-destructive/10 text-destructive border-destructive/30 px-3 py-1 text-sm gap-1.5"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {alertCount} {alertCount === 1 ? "alert" : "alert"}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Widget 2 — Triage / Risk Alerts
// ===========================================================================
function TriageWidget({
  alerts,
  smartCount,
  isLoading,
  onSelect,
}: {
  alerts: UrgentAlert[];
  smartCount: number;
  isLoading: boolean;
  onSelect: (athleteId: string) => void;
}) {
  return (
    <div className={cn(auraCard, "md:col-span-2 xl:col-span-2 flex flex-col min-h-[320px]")}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldAlert className="h-5 w-5 text-destructive" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">Triage</h2>
            <p className="text-xs text-on-surface-variant">ACWR · Readiness · RPE</p>
          </div>
        </div>
        {smartCount > 0 && (
          <Badge
            variant="outline"
            className="bg-destructive/10 text-destructive border-destructive/30 tabular-nums"
          >
            {smartCount} smart
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={1.75} />
          </div>
          <h3 className="font-display text-base font-semibold mb-1">Tutto OK</h3>
          <p className="text-sm text-on-surface-variant">Nessun atleta in zona critica.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mx-6 px-6 max-h-[260px]">
          <div className="space-y-2">
            {alerts.map((a) => (
              <TriageRow key={a.id} alert={a} onClick={() => onSelect(a.athleteId)} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function TriageRow({ alert, onClick }: { alert: UrgentAlert; onClick: () => void }) {
  const cfg = getAlertConfig(alert.alertType);
  const Icon = cfg.icon;
  const badgeClass = getSeverityBadge(alert.severity);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-secondary/30 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative flex-shrink-0">
        <Avatar
          className={cn(
            "h-10 w-10 ring-2",
            alert.severity === "critical" ? "ring-destructive/30" : "ring-warning/30",
          )}
        >
          <AvatarImage src={alert.avatarUrl || undefined} />
          <AvatarFallback className={cn("text-sm font-medium", cfg.bgClass, cfg.textClass)}>
            {alert.avatarInitials}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-surface-container-lowest flex items-center justify-center",
            alert.severity === "critical" ? "bg-destructive" : "bg-warning",
          )}
        >
          <Icon className="h-2.5 w-2.5 text-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate text-foreground">{alert.athleteName}</p>
          <Badge variant="outline" className={cn("text-3xs px-1.5 py-0 h-5", badgeClass)}>
            {alert.value}
          </Badge>
        </div>
        <p className="text-xs text-on-surface-variant truncate mt-0.5">{cfg.label}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-on-surface-variant/40 flex-shrink-0" />
    </button>
  );
}

// ===========================================================================
// Widget 3 — Today's Pulse (circular gauge)
// ===========================================================================
function PulseWidget({
  completed,
  scheduled,
  percentage,
  isLoading,
}: {
  completed: number;
  scheduled: number;
  percentage: number;
  isLoading: boolean;
}) {
  // SVG ring math: r=42 → circumference = 264
  const dash = (percentage / 100) * 264;
  const ringColor =
    percentage >= 80 ? "text-success" : percentage >= 50 ? "text-warning" : "text-destructive";

  return (
    <div className={cn(auraCard, "md:col-span-1 xl:col-span-2 flex flex-col min-h-[320px]")}>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
          <Activity className="h-5 w-5 text-primary" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Today&apos;s Pulse</h2>
          <p className="text-xs text-on-surface-variant">Completati vs programmati</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Skeleton className="h-32 w-32 rounded-full" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-outline-variant/30"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${dash} 264`}
                className={ringColor}
                stroke="currentColor"
                style={{ transition: "stroke-dasharray 0.6s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("font-display text-3xl font-bold tabular-nums", ringColor)}>
                {percentage}%
              </span>
              <span className="text-3xs text-on-surface-variant uppercase tracking-wide font-medium">
                aderenza
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="font-display text-xl font-bold text-foreground tabular-nums">
                {completed}
              </p>
              <p className="text-xs text-on-surface-variant">Completati</p>
            </div>
            <div className="h-8 w-px bg-outline-variant/40" />
            <div className="text-center">
              <p className="font-display text-xl font-bold text-foreground tabular-nums">
                {scheduled}
              </p>
              <p className="text-xs text-on-surface-variant">Programmati</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Widget 4 — Recent Completions
// ===========================================================================
type FeedbackItem = ReturnType<typeof useCoachDashboardMetrics>["feedbackItems"][number];

function RecentCompletionsWidget({
  items,
  isLoading,
  onView,
}: {
  items: FeedbackItem[];
  isLoading: boolean;
  onView: (athleteId: string) => void;
}) {
  return (
    <div className={cn(auraCard, "md:col-span-2 xl:col-span-3 flex flex-col min-h-[320px]")}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10">
            <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-foreground">
              Completati di Recente
            </h2>
            <p className="text-xs text-on-surface-variant">
              Workout finiti che attendono il tuo feedback
            </p>
          </div>
        </div>
        {items.length > 0 && (
          <Badge
            variant="outline"
            className="bg-success/10 text-success border-success/30 tabular-nums"
          >
            {items.length}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <Clock className="h-10 w-10 text-on-surface-variant/40 mb-3" />
          <p className="text-sm text-on-surface-variant">Nessun workout in attesa di feedback.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 -mx-6 px-6 max-h-[260px]">
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-secondary/20 hover:bg-secondary/40 transition-colors"
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={item.avatarUrl || undefined} />
                  <AvatarFallback className="bg-success/10 text-success text-xs font-medium">
                    {item.avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground">
                    {item.athleteName}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate">{item.workoutTitle}</p>
                </div>
                {item.rpeGlobal != null && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "tabular-nums",
                      item.rpeGlobal > 8
                        ? "bg-warning/10 text-warning border-warning/30"
                        : "bg-secondary/40 text-on-surface-variant border-outline-variant/40",
                    )}
                  >
                    RPE {item.rpeGlobal}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onView(item.athleteId)}
                  className="gap-1.5 flex-shrink-0"
                >
                  Vedi
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ===========================================================================
// Widget 5 — Quick Actions
// ===========================================================================
function QuickActionsWidget({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className={cn(auraCard, "md:col-span-1 xl:col-span-1 flex flex-col min-h-[320px]")}>
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
          <Zap className="h-5 w-5 text-secondary-foreground" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-foreground">Azioni Rapide</h2>
          <p className="text-xs text-on-surface-variant">Shortcut comuni</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <InviteAthleteDialog
          trigger={
            <Button className="w-full justify-start gap-3" size="lg">
              <UserPlus className="h-4 w-4" />
              Invita atleta
            </Button>
          }
        />
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start gap-3"
          onClick={() => onNavigate("/coach/programs")}
        >
          <PlusCircle className="h-4 w-4" />
          Nuovo programma
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start gap-3"
          onClick={() => onNavigate("/coach/calendar")}
        >
          <Calendar className="h-4 w-4" />
          Apri calendario
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start gap-3"
          onClick={() => onNavigate("/coach/messages")}
        >
          <MessageSquare className="h-4 w-4" />
          Messaggi
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full justify-start gap-3"
          onClick={() => onNavigate("/coach/exercises")}
        >
          <Dumbbell className="h-4 w-4" />
          Libreria esercizi
        </Button>
      </div>
    </div>
  );
}
