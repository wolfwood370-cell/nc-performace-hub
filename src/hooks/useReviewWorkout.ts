import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReviewWorkoutPayload {
  logId: string;
  feedback: string;
}

/**
 * Writes the coach's feedback onto a workout_log row, clearing it from the
 * "Needs Review" queue. Invalidates dashboard + check-in queries on success.
 */
export function useReviewWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, feedback }: ReviewWorkoutPayload) => {
      const trimmed = feedback.trim();
      if (!trimmed) throw new Error("Il feedback non può essere vuoto");
      if (!logId) throw new Error("ID sessione mancante");

      const { error } = await supabase
        .from("workout_logs")
        .update({ coach_feedback: trimmed })
        .eq("id", logId);

      if (error) throw error;
      return { logId, feedback: trimmed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["god-mode-workouts"] });
      toast.success("Feedback inviato all'atleta");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Errore durante l'invio del feedback");
    },
  });
}
