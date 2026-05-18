// =============================================================================
// src/components/coach/InviteAthleteDialog.tsx
// =============================================================================
// Coach-facing modal: generate a one-time onboarding link for an athlete.
//
// Replaces the previous email-based flow (Edge Function `invite-athlete`)
// with a manual-share flow:
//   1. Coach fills in first name, last name, email.
//   2. "Genera link" → INSERT into `athlete_onboarding_links` with a
//      fresh `unique_token` (UUID). RLS guard: only authenticated coaches
//      with `coach_id = auth.uid()` can insert.
//   3. On success, display the public URL `{origin}/auth?token=<...>` +
//      a copy-to-clipboard button so the coach can share it via WhatsApp,
//      email, or any other channel.
//   4. The athlete opens the URL → Auth.tsx prefills the signup form →
//      successful signup atomically calls `redeem_athlete_onboarding_link`
//      RPC and links the new athlete profile to this coach.
//
// Prop API preserved from the previous implementation:
//   - `trigger`: optional custom button (defaults to "Invita atleta" CTA)
//   - `onAthleteInvited`: optional callback fired after a link is created
//     (parent pages can refresh their athlete list / counters).
// =============================================================================

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { UserPlus, Loader2, Copy, Check, RefreshCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const inviteFormSchema = z.object({
  firstName: z
    .string()
    .min(1, "Il nome è obbligatorio")
    .max(60, "Il nome è troppo lungo"),
  lastName: z
    .string()
    .min(1, "Il cognome è obbligatorio")
    .max(60, "Il cognome è troppo lungo"),
  email: z.string().email("Indirizzo email non valido"),
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

interface InviteAthleteDialogProps {
  onAthleteInvited?: () => void;
  trigger?: React.ReactNode;
}

interface GeneratedInvite {
  url: string;
  fullName: string;
  email: string;
}

export function InviteAthleteDialog({
  onAthleteInvited,
  trigger,
}: InviteAthleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generated, setGenerated] = useState<GeneratedInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Devi effettuare l'accesso per invitare atleti.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const athleteEmail = data.email.toLowerCase().trim();
      const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
      const token = crypto.randomUUID();

      const { error } = await supabase
        .from("invite_tokens")
        .insert({
          coach_id: user.id,
          email: athleteEmail,
          full_name: fullName,
          token,
        });

      if (error) {
        // Unique-token collision is astronomically unlikely with UUIDv4
        // but we surface a clean message just in case.
        const message =
          error.code === "23505"
            ? "Esiste già un invito attivo per questa email."
            : error.message || "Errore nella generazione del link.";
        throw new Error(message);
      }

      const url = `${window.location.origin}/auth?token=${token}`;
      setGenerated({ url, fullName, email: athleteEmail });

      toast({
        title: "Invito creato",
        description: "Copia il link e mandalo all'atleta.",
      });

      onAthleteInvited?.();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Impossibile generare l'invito. Riprova.";
      toast({
        variant: "destructive",
        title: "Errore",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.url);
      setCopied(true);
      toast({
        title: "Link copiato",
        description: "Incollalo nella chat con l'atleta.",
      });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        variant: "destructive",
        title: "Clipboard non disponibile",
        description: "Seleziona il link e copialo manualmente.",
      });
    }
  };

  const handleGenerateAnother = () => {
    form.reset();
    setGenerated(null);
    setCopied(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting && !next) return;
    if (!next) {
      form.reset();
      setGenerated(null);
      setCopied(false);
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gradient-primary">
            <UserPlus className="h-4 w-4 mr-2" />
            Invita atleta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invita Atleta
          </DialogTitle>
          <DialogDescription>
            Genera un link di registrazione unico. L'atleta apre il link e
            completa il signup con nome ed email già compilati.
          </DialogDescription>
        </DialogHeader>

        {!generated ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 pt-2"
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mario"
                          autoComplete="given-name"
                          maxLength={60}
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cognome</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Rossi"
                          autoComplete="family-name"
                          maxLength={60}
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="mario.rossi@email.com"
                        autoComplete="email"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="gradient-primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generazione…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Genera link
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-medium text-primary mb-0.5">
                {generated.fullName}
              </p>
              <p className="text-muted-foreground text-xs">{generated.email}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-url">URL di registrazione</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-url"
                  type="text"
                  value={generated.url}
                  readOnly
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copia link negli appunti"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Il link è valido fino al primo utilizzo.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateAnother}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Genera altro
              </Button>
              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="gradient-primary"
              >
                Chiudi
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default InviteAthleteDialog;
