import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, ShieldAlert, User as UserIcon } from "lucide-react";
import { differenceInYears, parseISO } from "date-fns";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Biometrics {
  gender?: string | null;
  dateOfBirth?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
}

const GENDER_LABEL: Record<string, string> = {
  male: "Uomo",
  female: "Donna",
  other: "Altro",
};

export default function AthleteProfile() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<string>("");
  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");
  const [biometricsLoading, setBiometricsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setBiometricsLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, onboarding_data")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const bio = ((data?.onboarding_data as { biometrics?: Biometrics } | null)?.biometrics) ?? {};
      setFullName(data?.full_name ?? "");
      setDateOfBirth(bio.dateOfBirth ?? "");
      setGender(bio.gender ?? "");
      setHeightCm(bio.heightCm != null ? String(bio.heightCm) : "");
      setWeightKg(bio.weightKg != null ? String(bio.weightKg) : "");
      setBiometricsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const age = useMemo(() => {
    if (!dateOfBirth) return null;
    try {
      return differenceInYears(new Date(), parseISO(dateOfBirth));
    } catch {
      return null;
    }
  }, [dateOfBirth]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("onboarding_data")
        .eq("id", user.id)
        .maybeSingle();

      const prev = (existing?.onboarding_data as Record<string, unknown> | null) ?? {};
      const prevBio = ((prev as { biometrics?: Biometrics }).biometrics) ?? {};
      const nextOnboardingData = {
        ...prev,
        biometrics: {
          ...prevBio,
          gender: gender || null,
          dateOfBirth: dateOfBirth || null,
          heightCm: heightCm ? Number(heightCm) : null,
          weightKg: weightKg ? Number(weightKg) : null,
        },
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          onboarding_data: nextOnboardingData,
        })
        .eq("id", user.id);

      if (error) throw error;
      toast.success("Profilo aggiornato");
    } catch (e) {
      toast.error("Errore nel salvataggio", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-athlete", {
        body: { athlete_id: user.id },
      });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) {
        throw new Error((data as { error?: string }).error);
      }
      toast.success("Account eliminato");
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (e) {
      toast.error("Eliminazione non riuscita", {
        description: e instanceof Error ? e.message : "Riprova più tardi.",
      });
      setDeleting(false);
    }
  };

  const isLoading = loading || biometricsLoading;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-surface-variant px-5 h-16">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors"
          aria-label="Indietro"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display font-semibold text-base text-on-surface">
          Profilo
        </h1>
        <span className="w-10 h-10" aria-hidden />
      </header>

      <main className="px-5 pt-6 pb-32 space-y-8 max-w-md mx-auto">
        {/* Identity */}
        <section className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-3">
            <UserIcon className="w-9 h-9" strokeWidth={1.5} />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-40" />
          ) : (
            <>
              <h2 className="font-display text-xl font-bold text-on-surface">
                {fullName || "Atleta"}
              </h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                {user?.email}
              </p>
            </>
          )}
        </section>

        {/* Personal data */}
        <section className="bg-white rounded-3xl border border-surface-variant p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
            Dati personali
          </h3>

          <div className="space-y-2">
            <Label htmlFor="fullName">Nome e cognome</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Mario Rossi"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">
              Data di nascita {age !== null && <span className="text-on-surface-variant font-normal">· {age} anni</span>}
            </Label>
            <Input
              id="dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Genere</Label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              <option value="male">Uomo</option>
              <option value="female">Donna</option>
              <option value="other">Altro</option>
            </select>
            {gender && GENDER_LABEL[gender] && (
              <p className="text-xs text-on-surface-variant">{GENDER_LABEL[gender]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="height">Altezza (cm)</Label>
              <Input
                id="height"
                type="number"
                inputMode="numeric"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="175"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (kg)</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="70"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || isLoading}
            className="w-full mt-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              "Salva modifiche"
            )}
          </Button>
        </section>

        {/* Account */}
        <section className="space-y-3">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-on-surface-variant px-1">
            Account
          </h3>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-between bg-white rounded-2xl border border-surface-variant px-5 py-4 text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="flex items-center gap-3 font-medium">
              <LogOut className="w-5 h-5" />
              Esci
            </span>
          </button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between bg-white rounded-2xl border border-rose-200 px-5 py-4 text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <span className="flex items-center gap-3 font-semibold">
                  <ShieldAlert className="w-5 h-5" />
                  Elimina account
                </span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare definitivamente l'account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione è irreversibile. Tutti i tuoi dati (allenamenti, check-in,
                  nutrizione, biometriche) verranno eliminati in modo permanente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Eliminazione...
                    </>
                  ) : (
                    "Elimina definitivamente"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>
    </div>
  );
}
