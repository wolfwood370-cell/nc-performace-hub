import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export interface BillingPlan {
  id: string;
  coach_id: string;
  name: string;
  price_amount: number; // cents
  currency: string;
  billing_interval: string;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  active: boolean;
  description: string | null;
  created_at: string;
}

interface AthleteSubscriptionRow {
  id: string;
  athlete_id: string;
  plan_id: string;
  status: "active" | "past_due" | "canceled" | "incomplete";
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
}

export function useBillingPlans() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const plansQuery = useQuery({
    queryKey: ["billing-plans", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("billing_plans")
        .select("*")
        .eq("coach_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BillingPlan[];
    },
    enabled: !!user,
  });

  const createPlanMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      price_amount: number;
      billing_interval: string;
      description?: string;
    }) => {
      if (!user) throw new Error("Non autenticato");
      const { data, error } = await supabase
        .from("billing_plans")
        .insert({
          coach_id: user.id,
          name: payload.name,
          price_amount: payload.price_amount,
          billing_interval: payload.billing_interval,
          description: payload.description || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-plans"] });
      toast({ title: "Piano creato", description: "Il nuovo piano è stato aggiunto." });
    },
    onError: (e) => {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("billing_plans")
        .update({ active: false })
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-plans"] });
      toast({ title: "Piano archiviato" });
    },
  });

  // Generate checkout link
  const checkoutMutation = useMutation({
    mutationFn: async ({ planId, athleteId }: { planId: string; athleteId: string }) => {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { plan_id: planId, athlete_id: athleteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { url: string };
    },
    onError: (e) => {
      toast({ title: "Errore checkout", description: e.message, variant: "destructive" });
    },
  });

  return {
    plans: plansQuery.data ?? [],
    isLoadingPlans: plansQuery.isLoading,
    createPlan: createPlanMutation.mutate,
    isCreatingPlan: createPlanMutation.isPending,
    deletePlan: deletePlanMutation.mutate,
    generateCheckout: checkoutMutation.mutateAsync,
    isGeneratingCheckout: checkoutMutation.isPending,
  };
}

// Separate hook for athlete-side subscription view
function useAthleteSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["athlete-subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("athlete_subscriptions")
        .select("*, billing_plans(*)")
        .eq("athlete_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as (AthleteSubscriptionRow & { billing_plans: BillingPlan }) | null;
    },
    enabled: !!user,
  });
}
