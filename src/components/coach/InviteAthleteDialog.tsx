import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { UserPlus, Loader2 } from "lucide-react";
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

function describeInviteError(error: unknown): string {
  if (!error) return "Impossibile invitare l'atleta. Riprova.";

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Impossibile invitare l'atleta. Riprova.";

  const lower = message.toLowerCase();

  if (
    lower.includes("already exists") ||
    lower.includes("user_already_exists") ||
    lower.includes("already been registered")
  ) {
    return "Esiste già un account con questa email.";
  }

  if (lower.includes("rate") && lower.includes("limit")) {
    return "Troppi inviti inviati. Riprova tra qualche minuto.";
  }

  if (lower.includes("only coaches")) {
    return "Solo i coach possono invitare atleti.";
  }

  return message;
}

export function InviteAthleteDialog({
  onAthleteInvited,
  trigger,
}: InviteAthleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (!user) {
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
      const firstName = data.firstName.trim();
      const lastName = data.lastName.trim();

      const { data: result, error } = await supabase.functions.invoke(
        "invite-athlete",
        {
          body: {
            athleteEmail,
            firstName,
            lastName,
          },
        },
      );

      if (error) {
        let serverMessage: string | undefined;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body && typeof body.error === "string") {
              serverMessage = body.error;
            }
          }
        } catch {
          /* fall through to error.message */
        }
        throw new Error(serverMessage ?? error.message);
      }

      if (result && typeof result === "object" && "error" in result) {
        throw new Error(String((result as { error: unknown }).error));
      }

      toast({
        title: "Invito inviato con successo",
        description: `Email di invito inviata a ${athleteEmail}.`,
      });

      form.reset();
      setOpen(false);
      onAthleteInvited?.();
    } catch (error: unknown) {
      console.error("Error inviting athlete:", error);
      toast({
        variant: "destructive",
        title: "Errore",
        description: describeInviteError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting && !next) return;
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invita Atleta
          </DialogTitle>
          <DialogDescription>
            Invia un invito a un nuovo atleta per unirsi al tuo programma di
            coaching.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-4"
          >
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
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
                    Invio...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invia Invito
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
