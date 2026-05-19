import { useState } from "react";
import { CoachLayout } from "@/components/coach/CoachLayout";
import { MetaHead } from "@/components/MetaHead";
import { useWeeklyCheckins, WeeklyCheckin } from "@/hooks/useWeeklyCheckins";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Zap,
  Send,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  SkipForward,
  TrendingUp,
  Dumbbell,
  Target,
  Flame,
  type LucideIcon,
} from "lucide-react";

function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-muted/50 px-3 py-1 text-xs">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function CheckinCard({
  checkin,
  onApprove,
  onSkip,
  onUpdate,
  isSending,
}: {
  checkin: WeeklyCheckin;
  onApprove: (c: WeeklyCheckin) => void;
  onSkip: (c: WeeklyCheckin) => void;
  onUpdate: (id: string, text: string) => void;
  isSending: boolean;
}) {
  const [editedText, setEditedText] = useState(checkin.coach_notes || checkin.ai_summary || "");
  const [isEditing, setIsEditing] = useState(false);

  const metrics = checkin.metrics_snapshot;
  const initials =
    checkin.athlete?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

  const statusConfig = {
    pending: {
      label: "In Attesa",
      icon: Clock,
      color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    },
    approved: {
      label: "Approvato",
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    },
    sent: { label: "Inviato", icon: Send, color: "bg-primary/10 text-primary border-primary/20" },
    skipped: {
      label: "Scartato",
      icon: SkipForward,
      color: "bg-muted text-muted-foreground border-border",
    },
  };

  const status = statusConfig[checkin.status];

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={checkin.athlete?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-foreground">
                {checkin.athlete?.full_name || "Atleta"}
              </h3>
              <p className="text-xs text-muted-foreground">
                Settimana del{" "}
                {new Date(checkin.week_start).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={status.color}>
            <status.icon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Metrics pills */}
        {metrics && (
          <div className="flex flex-wrap gap-2">
            {metrics.compliance_pct !== undefined && (
              <MetricPill icon={Target} label="Compliance" value={`${metrics.compliance_pct}%`} />
            )}
            {metrics.total_volume !== undefined && (
              <MetricPill icon={Dumbbell} label="Volume" value={`${metrics.total_volume} UA`} />
            )}
            {metrics.avg_rpe && metrics.avg_rpe !== "N/A" && (
              <MetricPill icon={Flame} label="RPE" value={metrics.avg_rpe} />
            )}
            {metrics.workouts_completed !== undefined && (
              <MetricPill
                icon={TrendingUp}
                label="Sessioni"
                value={`${metrics.workouts_completed}/${metrics.workouts_scheduled || 0}`}
              />
            )}
          </div>
        )}

        {/* Editable AI summary */}
        {checkin.status === "pending" ? (
          <div className="space-y-2">
            <Textarea
              value={editedText}
              onChange={(e) => {
                setEditedText(e.target.value);
                if (!isEditing) setIsEditing(true);
              }}
              className="min-h-[100px] text-sm resize-none"
              placeholder="Report AI in generazione..."
            />
            {isEditing && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onUpdate(checkin.id, editedText);
                    setIsEditing(false);
                  }}
                >
                  Salva bozza
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
            {checkin.coach_notes || checkin.ai_summary}
          </p>
        )}

        {/* Actions */}
        {checkin.status === "pending" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                if (isEditing) onUpdate(checkin.id, editedText);
                onApprove({ ...checkin, coach_notes: editedText || checkin.coach_notes });
              }}
              disabled={isSending}
              className="flex-1"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Approva & Invia
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSkip(checkin)}
              disabled={isSending}
            >
              <X className="h-4 w-4 mr-1" />
              Scarta
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CoachCheckinInbox() {
  const { checkins, isLoading, generateCheckins, updateCheckin, approveAndSend } =
    useWeeklyCheckins();

  const pendingCheckins = checkins.filter((c) => c.status === "pending");
  const sentCheckins = checkins.filter((c) => c.status === "sent");
  const skippedCheckins = checkins.filter((c) => c.status === "skipped");

  const handleApprove = (checkin: WeeklyCheckin) => {
    approveAndSend.mutate(checkin);
  };

  const handleSkip = (checkin: WeeklyCheckin) => {
    updateCheckin.mutate({ id: checkin.id, updates: { status: "skipped" } });
  };

  const handleUpdateText = (id: string, text: string) => {
    updateCheckin.mutate({ id, updates: { coach_notes: text } });
  };

  return (
    <>
      <MetaHead title="Inbox Check-in" description="Revisione settimanale degli atleti." />
      <CoachLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Revisione Settimanale</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Rivedi e invia i report AI ai tuoi atleti
              </p>
            </div>
            <Button
              onClick={() => generateCheckins.mutate()}
              disabled={generateCheckins.isPending}
              className="gap-2"
            >
              {generateCheckins.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Analizza Tutti
            </Button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                In Attesa
                {pendingCheckins.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">
                    {pendingCheckins.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Inviati
              </TabsTrigger>
              <TabsTrigger value="skipped" className="gap-1.5">
                <SkipForward className="h-3.5 w-3.5" />
                Scartati
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingCheckins.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <Zap className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      Nessun report in attesa. Clicca "Analizza Tutti" per generare i report
                      settimanali.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {pendingCheckins.map((checkin) => (
                    <CheckinCard
                      key={checkin.id}
                      checkin={checkin}
                      onApprove={handleApprove}
                      onSkip={handleSkip}
                      onUpdate={handleUpdateText}
                      isSending={approveAndSend.isPending}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent" className="mt-4">
              {sentCheckins.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="text-center">
                    <p className="text-muted-foreground">Nessun report inviato.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {sentCheckins.map((checkin) => (
                    <CheckinCard
                      key={checkin.id}
                      checkin={checkin}
                      onApprove={handleApprove}
                      onSkip={handleSkip}
                      onUpdate={handleUpdateText}
                      isSending={false}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="skipped" className="mt-4">
              {skippedCheckins.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="text-center">
                    <p className="text-muted-foreground">Nessun report scartato.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {skippedCheckins.map((checkin) => (
                    <CheckinCard
                      key={checkin.id}
                      checkin={checkin}
                      onApprove={handleApprove}
                      onSkip={handleSkip}
                      onUpdate={handleUpdateText}
                      isSending={false}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CoachLayout>
    </>
  );
}
