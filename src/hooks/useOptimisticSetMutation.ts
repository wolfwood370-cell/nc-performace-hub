import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveSessionStore, type SetLog } from "@/stores/useActiveSessionStore";
import { toast } from "sonner";

interface SetPayload {
  exerciseId: string;
  setIndex: number;
  field: keyof SetLog;
  value: string | boolean;
}

/**
 * Optimistic mutation for logging individual set fields.
 * Updates the Zustand store instantly (onMutate) and rolls back on error.
 */
export function useSetMutation() {
  const queryClient = useQueryClient();
  const updateSetField = useActiveSessionStore((s) => s.updateSetField);
  const completeSet = useActiveSessionStore((s) => s.completeSet);

  return useMutation({
    mutationFn: async (payload: SetPayload) => {
      // The actual DB write happens at session-end (bulk save).
      // This mutation is for local-first persistence via the Zustand store.
      return payload;
    },

    onMutate: async (payload) => {
      const { exerciseId, setIndex, field, value } = payload;

      // 1. Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["athlete-today-workout"] });
      await queryClient.cancelQueries({ queryKey: ["athlete-active-program"] });

      // 2. Snapshot for rollback
      const prevLogs = useActiveSessionStore.getState().sessionLogs;

      // 3. Optimistic update in Zustand store (immediate UI)
      if (field === "completed" && value === true) {
        const logs = useActiveSessionStore.getState().sessionLogs[exerciseId] ?? [];
        const current = logs.find((l) => l.setIndex === setIndex);
        completeSet(exerciseId, setIndex, {
          actualKg: current?.actualKg ?? "",
          actualReps: current?.actualReps ?? "",
          rpe: current?.rpe ?? "",
          completed: true,
        });
      } else {
        updateSetField(exerciseId, setIndex, field, value);
      }

      return { prevLogs };
    },

    onError: (_err, _payload, context) => {
      // Rollback to snapshot
      if (context?.prevLogs) {
        useActiveSessionStore.setState({ sessionLogs: context.prevLogs });
      }
      toast.error("Errore di sincronizzazione set");
    },

    onSettled: () => {
      // Re-sync from server in background
      queryClient.invalidateQueries({ queryKey: ["athlete-today-workout"] });
    },
  });
}
