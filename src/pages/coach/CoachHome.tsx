import { CoachLayout } from"@/components/coach/CoachLayout";
import { MetaHead } from"@/components/MetaHead";
import { Card, CardContent } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { ScrollArea } from"@/components/ui/scroll-area";
import { Skeleton } from"@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from"@/components/ui/avatar";
import { InviteAthleteDialog } from"@/components/coach/InviteAthleteDialog";
import { RiskTable } from"@/components/coach/RiskTable";
import { RiskAlertCard } from"@/components/coach/RiskAlertCard";

import { useAuth } from"@/hooks/useAuth";
import { useNavigate } from"react-router-dom";
import { useEffect } from"react";
import { 
  useCoachDashboardMetrics,
  type UrgentAlert,
  type AlertType,
  type AlertSeverity,
} from"@/hooks/useCoachDashboardMetrics";
import { useCoachAlerts, type CoachAlert } from"@/hooks/useCoachAlerts";
import { useChatRooms } from"@/hooks/useChatRooms";
import { toast } from"sonner";
import { 
  AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Battery,
  CheckCircle2, UserPlus, ChevronRight, Calendar, MessageSquare,
  Activity, Flame, AlertCircle, Clock, Users, DollarSign, Target, Zap, CalendarX,
} from"lucide-react";
import { cn } from"@/lib/utils";
import { format, formatDistanceToNow } from"date-fns";
import { it } from"date-fns/locale";

// ===== ALERT CONFIGURATION =====
const getAlertConfig = (type: AlertType) => {
  const configs: Record<AlertType, { icon: typeof AlertTriangle; label: string; bgClass: string; textClass: string }> = {
    missed_workout: { icon: CalendarX, label:"Allenamento Saltato", bgClass:"bg-destructive/10", textClass:"text-destructive" },
    low_readiness: { icon: Battery, label:"Readiness Bassa", bgClass:"bg-destructive/10", textClass:"text-destructive" },
    active_injury: { icon: AlertCircle, label:"Infortunio Attivo", bgClass:"bg-destructive/10", textClass:"text-destructive" },
    high_acwr: { icon: Flame, label:"ACWR Elevato", bgClass:"bg-warning/10", textClass:"text-warning" },
    rpe_spike: { icon: Zap, label:"RPE Elevato", bgClass:"bg-warning/10", textClass:"text-warning" },
    no_checkin: { icon: Clock, label:"Nessun Check-in", bgClass:"bg-muted", textClass:"text-muted-foreground" },
  };
  return configs[type] ?? { icon: AlertTriangle, label:"Alert", bgClass:"bg-muted", textClass:"text-muted-foreground" };
};

const getSeverityStyles = (severity: AlertSeverity) => {
  switch (severity) {
    case"critical": return { ring:"ring-destructive/30", bg:"bg-destructive", badge:"bg-destructive/10 text-destructive border-destructive/30"};
    case"warning": return { ring:"ring-warning/30", bg:"bg-warning", badge:"bg-warning/10 text-warning border-warning/30"};
    default: return { ring:"ring-muted", bg:"bg-muted-foreground", badge:"bg-muted text-muted-foreground border-border"};
  }
};

/* ── Glassmorphism card wrapper ── */
const glass = "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm shadow-sky-900/5 rounded-2xl";

export default function CoachHome() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { urgentAlerts, feedbackItems, todaySchedule, businessMetrics, healthyAthletes, isLoading } = useCoachDashboardMetrics();
  const { alerts: smartAlerts, isLoading: alertsLoading, dismissAlert } = useCoachAlerts();
  const { getOrCreateDirectRoom } = useChatRooms();

  const criticalAlerts = urgentAlerts.filter(a => a.severity ==="critical"|| a.severity ==="warning");
  const infoAlerts = urgentAlerts.filter(a => a.severity ==="info");

  const handleMessageFromAlert = async (alert: CoachAlert) => {
    try {
      if (!user?.id) return;
      const roomId = await getOrCreateDirectRoom.mutateAsync(alert.athlete_id);
      const alertContext = encodeURIComponent(JSON.stringify({ message: alert.message, severity: alert.severity, workoutLogId: alert.workout_log_id, createdAt: alert.created_at }));
      navigate(`/coach/messages?room=${roomId}&alertContext=${alertContext}`);
    } catch { toast.error("Errore nell'apertura della chat"); }
  };

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <CoachLayout title="Centro di Comando" subtitle="Caricamento...">
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl"/>
          <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i=><Skeleton key={i} className="h-32 rounded-2xl"/>)}</div>
        </div>
      </CoachLayout>
    );
  }

  const hasAthletes = businessMetrics.activeClients > 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? "Coach";

  return (
    <>
    <MetaHead title="Dashboard" description="Centro di comando per il tuo coaching."/>
    <CoachLayout title="Centro di Comando" subtitle="Triage Giornaliero">
      <div className="space-y-6 animate-fade-in">

        {/* ═══ HEADER GREETING ═══ */}
        <div className={cn(glass, "p-5 md:p-6")}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Buongiorno, {firstName}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
                {format(new Date(),"EEEE d MMMM yyyy", { locale: it })}
              </p>
            </div>
            {criticalAlerts.length > 0 && (
              <Badge variant="destructive" className="self-start sm:self-auto tabular-nums text-sm px-3 py-1 rounded-xl animate-pulse-soft">
                <ShieldAlert className="h-3.5 w-3.5 mr-1.5"/>
                {criticalAlerts.length} allerte critiche
              </Badge>
            )}
          </div>
        </div>

        {/* ═══ EMPTY STATE ═══ */}
        {!isLoading && !hasAthletes && (
          <div className={cn(glass, "p-12 text-center")}>
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-6 ring-4 ring-primary/10">
              <UserPlus className="h-10 w-10 text-primary"/>
            </div>
            <h3 className="font-display text-xl font-bold text-foreground mb-2">Benvenuto, Coach!</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">Invita il tuo primo atleta per iniziare a monitorare carico, recupero e performance in tempo reale.</p>
            <InviteAthleteDialog trigger={<Button className="gradient-primary h-12 px-8 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"><UserPlus className="h-5 w-5 mr-2"/>Invita il Primo Atleta</Button>}/>
          </div>
        )}

        {/* ═══ BENTO GRID ═══ */}
        {hasAthletes && (<>

          {/* Row 0: Smart Alerts Watchdog */}
          <RiskAlertCard alerts={smartAlerts} isLoading={alertsLoading} onDismiss={(id) => dismissAlert.mutate(id)} onMessageAthlete={handleMessageFromAlert} onNavigate={(link) => navigate(link)}/>

          {/* ── KPI Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={Users} label="Atleti Attivi" value={businessMetrics.activeClients} color="sky"/>
            <KpiCard icon={DollarSign} label="Ricavo Mensile" value={`€${businessMetrics.monthlyRecurringRevenue}`} color="emerald"/>
            <KpiCard icon={Target} label="Tasso Check-in" value={`${businessMetrics.complianceRate}%`} color={businessMetrics.complianceRate >= 80 ?"emerald": businessMetrics.complianceRate >= 50 ?"amber":"rose"}/>
            {businessMetrics.churnRisk > 0
              ? <KpiCard icon={TrendingDown} label="A Rischio" value={businessMetrics.churnRisk} color="rose"/>
              : <KpiCard icon={CheckCircle2} label="Avg Readiness" value={businessMetrics.avgReadiness != null ? `${businessMetrics.avgReadiness}%` :"—"} color="sky"/>
            }
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

            {/* ── THE RADAR: Urgent Alerts ── */}
            <div className={cn(glass, "md:col-span-8 overflow-hidden flex flex-col")}>
              <div className="flex items-center justify-between p-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10"><ShieldAlert className="h-5 w-5 text-destructive"/></div>
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">Allerte Urgenti</h2>
                    <p className="text-xs text-slate-500">ACWR • Readiness • Infortuni • RPE</p>
                  </div>
                </div>
                {criticalAlerts.length > 0 && <Badge variant="destructive" className="tabular-nums px-3">{criticalAlerts.length}</Badge>}
              </div>
              {isLoading ? (
                <div className="p-5 pt-0 space-y-3">{[1,2,3].map(i=><div key={i} className="flex items-center gap-4 p-3"><Skeleton className="h-10 w-10 rounded-full"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-32"/><Skeleton className="h-3 w-48"/></div></div>)}</div>
              ) : criticalAlerts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="h-14 w-14 rounded-full bg-success/10 flex items-center justify-center mb-3"><CheckCircle2 className="h-7 w-7 text-success"/></div>
                  <h3 className="font-display text-base font-semibold mb-1">Tutto OK!</h3>
                  <p className="text-sm text-slate-500">Nessun atleta in zona critica.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[340px] flex-1">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">{criticalAlerts.map(a=><AlertRow key={a.id} alert={a} onClick={()=>navigate(`/coach/athlete/${a.athleteId}`)}/>)}</div>
                </ScrollArea>
              )}
            </div>

            {/* ── ACTION INBOX ── */}
            <div className={cn(glass, "md:col-span-4 overflow-hidden flex flex-col")}>
              <div className="flex items-center justify-between p-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10"><MessageSquare className="h-5 w-5 text-warning"/></div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">Da Rivedere</h2>
                </div>
                {feedbackItems.length > 0 && <Badge className="tabular-nums px-3 bg-warning/10 text-warning border-warning/20">{feedbackItems.length}</Badge>}
              </div>
              {isLoading ? (
                <div className="p-5 pt-0 space-y-2">{[1,2].map(i=><Skeleton key={i} className="h-14 rounded-xl"/>)}</div>
              ) : feedbackItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2"/>
                  <p className="text-sm text-slate-500">Nessun feedback in sospeso</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[340px] flex-1">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">{feedbackItems.map(item=>(
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group" onClick={()=>navigate(`/coach/athlete/${item.athleteId}`)}>
                      <Avatar className="h-9 w-9"><AvatarImage src={item.avatarUrl||undefined}/><AvatarFallback className="bg-warning/10 text-warning text-xs font-medium">{item.avatarInitials}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.athleteName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-400 truncate">{item.workoutTitle}</span>
                          {item.rpeGlobal&&<Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4",item.rpeGlobal>8?"border-warning/50 text-warning":"")}>RPE {item.rpeGlobal}</Badge>}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0"/>
                    </div>
                  ))}</div>
                </ScrollArea>
              )}
            </div>

            {/* ── TODAY'S SCHEDULE ── */}
            <div className={cn(glass, "md:col-span-5 overflow-hidden flex flex-col")}>
              <div className="flex items-center justify-between p-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10"><Calendar className="h-5 w-5 text-sky-500"/></div>
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">Programma Oggi</h2>
                </div>
                <Badge variant="secondary" className="tabular-nums bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">{todaySchedule.length}</Badge>
              </div>
              {isLoading ? (
                <div className="p-5 pt-0 space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-12 rounded-xl"/>)}</div>
              ) : todaySchedule.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm text-slate-500">Nessun allenamento oggi</p>
                  <Button variant="link" size="sm" className="mt-2 text-xs" onClick={()=>navigate("/coach/programs")}>Crea un programma</Button>
                </div>
              ) : (
                <ScrollArea className="max-h-[220px] flex-1">
                  <div className="px-3 pb-3 space-y-1">{todaySchedule.map(w=>(
                    <div key={w.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50/80 dark:hover:bg-slate-800/30 cursor-pointer transition-colors" onClick={()=>navigate(`/coach/athlete/${w.athleteId}`)}>
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-sky-500/10 text-sky-600 text-xs">{w.avatarInitials}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{w.athleteName}</p><p className="text-xs text-slate-400 truncate">{w.title}</p></div>
                      <Activity className="h-4 w-4 text-slate-300"/>
                    </div>
                  ))}</div>
                </ScrollArea>
              )}
            </div>

            {/* ── OPTIMAL ZONE ── */}
            <div className={cn(glass, "md:col-span-4 overflow-hidden")}>
              <div className="flex items-center gap-2 p-5 pb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-success animate-pulse"/><h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">Zona Ottimale</h2>
                <Badge variant="secondary" className="ml-auto text-xs tabular-nums bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">{healthyAthletes.length}</Badge>
              </div>
              <div className="px-5 pb-5">
                {healthyAthletes.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Tutti richiedono attenzione</p>
                ) : (
                  <div className="flex flex-wrap gap-2">{healthyAthletes.slice(0,14).map(a=>(
                    <Avatar key={a.id} className="h-9 w-9 border-2 border-success/30 cursor-pointer hover:scale-110 transition-transform" title={`${a.name}${a.readinessScore?` (${a.readinessScore}%)`:''}`} onClick={()=>navigate(`/coach/athlete/${a.id}`)}>
                      <AvatarImage src={a.avatarUrl||undefined}/><AvatarFallback className="text-[10px] bg-success/10 text-success font-medium">{a.avatarInitials}</AvatarFallback>
                    </Avatar>
                  ))}
                  {healthyAthletes.length>14&&<div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-medium text-slate-500 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={()=>navigate("/coach/athletes")}>+{healthyAthletes.length-14}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* ── AWAITING CHECK-IN ── */}
            <div className={cn(glass, "md:col-span-3 overflow-hidden")}>
              <div className="flex items-center gap-2 p-5 pb-3">
                <Clock className="h-4 w-4 text-slate-400"/><h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">In Attesa</h2>
                <Badge variant="secondary" className="ml-auto text-xs tabular-nums">{infoAlerts.length}</Badge>
              </div>
              {infoAlerts.length === 0 ? (
                <div className="px-5 pb-5"><p className="text-sm text-slate-500">Tutti hanno fatto il check-in! 🎉</p></div>
              ) : (
                <ScrollArea className="max-h-[140px]">
                  <div className="px-4 pb-4 flex flex-wrap gap-2">{infoAlerts.slice(0,10).map(a=>(
                    <div key={a.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer transition-colors" onClick={()=>navigate(`/coach/athlete/${a.athleteId}`)}>
                      <Avatar className="h-6 w-6"><AvatarImage src={a.avatarUrl||undefined}/><AvatarFallback className="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-500">{a.avatarInitials}</AvatarFallback></Avatar>
                      <span className="text-xs font-medium truncate max-w-[80px]">{a.athleteName.split(" ")[0]}</span>
                    </div>
                  ))}
                  {infoAlerts.length>10&&<div className="px-2 py-1.5 text-xs text-slate-400">+{infoAlerts.length-10} altri</div>}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          {/* ═══ RISK TABLE ═══ */}
          <RiskTable/>
        </>)}
      </div>
    </CoachLayout>
    </>
  );
}

/* ═══════════════════════════════════════════════
   KPI METRIC CARD
   ═══════════════════════════════════════════════ */
function KpiCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string|number; color: string }) {
  const palette: Record<string,string> = {
    sky:"from-sky-500/10 to-sky-500/5 text-sky-600 dark:text-sky-400",
    emerald:"from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    amber:"from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400",
    rose:"from-rose-500/10 to-rose-500/5 text-rose-600 dark:text-rose-400",
  };
  const p = palette[color] ?? palette.sky;
  const iconColor = p.split(" ").find(c=>c.startsWith("text-")) ?? "text-sky-600";

  return (
    <div className={cn("bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-sm shadow-sky-900/5 hover-lift")}>
      <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br mb-3", p.split(" ").slice(0,2).join(" "))}>
        <Icon className={cn("h-4.5 w-4.5",iconColor)} strokeWidth={1.75}/>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ALERT ROW
   ═══════════════════════════════════════════════ */
function AlertRow({ alert, onClick }: { alert: UrgentAlert; onClick: () => void }) {
  const config = getAlertConfig(alert.alertType);
  const severity = getSeverityStyles(alert.severity);
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group" onClick={onClick}>
      <div className="relative flex-shrink-0">
        <Avatar className={cn("h-10 w-10 ring-2", severity.ring)}>
          <AvatarImage src={alert.avatarUrl||undefined}/>
          <AvatarFallback className={cn("text-sm font-medium", config.bgClass, config.textClass)}>{alert.avatarInitials}</AvatarFallback>
        </Avatar>
        <div className={cn("absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center", severity.bg)}>
          <Icon className="h-2.5 w-2.5 text-white"/>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate text-slate-900 dark:text-slate-50">{alert.athleteName}</p>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", severity.badge)}>{alert.value}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 hidden sm:inline-flex">{config.label}</Badge>
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{alert.details}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"/>
    </div>
  );
}
