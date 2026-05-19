import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { ProgramExercise } from "@/components/coach/WeekGrid";
import type { Json } from "@/integrations/supabase/types";

export interface WorkoutTemplate {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  structure: ProgramExercise[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  structure: ProgramExercise[];
  tags?: string[];
}

export function useWorkoutTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all templates for the coach
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["workout-templates", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("workout_templates")
        .select("*")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((t) => ({
        ...t,
        // JSONB column read: Supabase types `structure` as `Json` (no index
        // signature). The `as unknown as ProgramExercise[]` bridge is the
        // only TS-accepted way to narrow without runtime validation. Move
        // to zod parsing here when the schema stabilises.
        structure: (t.structure as unknown as ProgramExercise[]) || [],
        tags: t.tags || [],
      })) as WorkoutTemplate[];
    },
    enabled: !!user?.id,
  });

  // Get unique tags from all templates
  const allTags = [...new Set(templates.flatMap((t) => t.tags))].sort();

  // Create new template
  const createMutation = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      if (!user?.id) throw new Error("Utente non autenticato");

      // Clean exercises for storage (remove empty slots, generate new IDs later on load)
      const cleanedStructure = input.structure
        .filter((ex) => !ex.isEmpty && ex.exerciseId)
        .map((ex) => ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          load: ex.load,
          rpe: ex.rpe,
          restSeconds: ex.restSeconds,
          notes: ex.notes,
          snapshotMuscles: ex.snapshotMuscles,
          snapshotTrackingFields: ex.snapshotTrackingFields,
        }));

      if (cleanedStructure.length === 0) {
        throw new Error("Il template deve contenere almeno un esercizio");
      }

      const { data, error } = await supabase
        .from("workout_templates")
        .insert({
          coach_id: user.id,
          name: input.name,
          description: input.description || null,
          structure: cleanedStructure as Json,
          tags: input.tags || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      toast.success("Template salvato con successo!");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from("workout_templates").delete().eq("id", templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-templates"] });
      toast.success("Template eliminato");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  // Convert template structure to program exercises with new IDs
  const hydrateTemplate = (template: WorkoutTemplate): ProgramExercise[] => {
    return template.structure.map((ex) => ({
      ...ex,
      id: crypto.randomUUID(), // Generate NEW unique ID
      isEmpty: false,
    }));
  };

  return {
    templates,
    allTags,
    isLoading,
    createTemplate: createMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    hydrateTemplate,
  };
}
