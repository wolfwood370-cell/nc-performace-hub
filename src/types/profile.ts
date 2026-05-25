// =============================================================================
// src/types/profile.ts
// =============================================================================
// Strongly-typed contracts for the `profiles.settings` JSONB column.
//
// Why a separate file:
//   - Supabase generates `settings: Json` (free-form) in types.ts. That
//     forces every consumer to do `as any` / `as unknown as` casts, which
//     defeats type-checking and was flagged in the coach audit as C2.
//   - Keeping the shape here (instead of in types.ts) means it survives
//     `supabase gen types` regenerations without merge conflicts.
//
// Convention: every field is optional and nullable. The DB schema makes
// no individual-key guarantees on the JSONB blob — only the column-level
// "this is some JSON" — so consumers must defend with `??` defaults.
// =============================================================================

/** Coach-managed training-status flag on the athlete profile. */
type TrainingStatus = "active" | "paused" | "archived";

/** Coarse experience level used in onboarding + analytics defaults. */
type ExperienceLevel = "beginner" | "intermediate" | "advanced";

/**
 * Per-profile JSONB blob stored at `profiles.settings`. Used by both
 * the coach-facing AthleteDetail edits and any athlete-facing
 * personalisation. Add new keys here, NOT inline at the call site.
 */
export interface ProfileSettings {
  /** Whether the athlete is actively coached (vs paused / archived). */
  training_status?: TrainingStatus;
  /** Coarse experience band. */
  experience_level?: ExperienceLevel;
  /** Free-form notes the coach keeps about this athlete. */
  coach_notes?: string;
  /** Set true by `archive_athlete` RPC. Mirrored here for client checks. */
  archived?: boolean;
  /** ISO timestamp set alongside `archived = true`. */
  archived_at?: string | null;
}
