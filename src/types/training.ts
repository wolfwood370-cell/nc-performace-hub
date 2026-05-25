/**
 * Training Program Type Definitions
 *
 * Models a hierarchical training program based on classical periodization:
 *   ProgramBlock (Macrocycle, e.g. 4-12 weeks)
 *     └─ Microcycle (1 week of training)
 *         └─ Session (a single training day)
 *             └─ ProgrammedExercise (a movement, optionally part of a superset)
 *                 └─ ProgrammedSet (a single working set with auto-regulation targets)
 *
 * Auto-regulation glossary:
 *   - RPE (Rate of Perceived Exertion): subjective 1-10 scale of set difficulty.
 *     RPE 10 = no reps left in the tank; RPE 8 = ~2 reps in reserve.
 *   - RIR (Reps In Reserve): how many reps the athlete could have performed
 *     before technical failure. RIR 0 ≈ RPE 10, RIR 2 ≈ RPE 8.
 *   - %1RM: load prescribed as a percentage of the athlete's one-rep max.
 *
 * A coach typically prescribes ONE of (rpe_target | rir_target | percent_1rm_target)
 * per set, but the schema permits combinations (e.g. "75% @ RPE 8 cap").
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

/**
 * Primary training goal for the macrocycle. Drives default rep ranges,
 * rest periods, and RPE targets when scaffolding sessions.
 */
export type ProgramGoal =
  | "Hypertrophy"
  | "Strength"
  | "Peaking"
  | "GPP" // General Physical Preparedness
  | "Deload";

/** ISO-8601 date string (YYYY-MM-DD). Kept as string for JSON serializability. */
type ISODateString = string;

/** UUID v4 string. Generated client-side via crypto.randomUUID(). */
export type UUID = string;

// ---------------------------------------------------------------------------
// Atomic level: ProgrammedSet
// ---------------------------------------------------------------------------

/**
 * A single prescribed working set.
 *
 * `reps_target` is intentionally a string to support coach shorthand like
 * "8-10", "AMRAP", "3+", or "5". This is parsed downstream when logging.
 */
export interface ProgrammedSet {
  id: UUID;
  /** 1-indexed position within the parent exercise (1 = first working set). */
  set_number: number;
  /** Free-form rep prescription, e.g. "8-10", "5", "AMRAP". */
  reps_target: string;
  /** Target Rate of Perceived Exertion, 1-10 scale. Mutually informative with rir_target. */
  rpe_target?: number;
  /** Target Reps In Reserve. RIR 2 ≈ RPE 8. */
  rir_target?: number;
  /** Target load as percentage of 1RM, 0-100. */
  percent_1rm_target?: number;
  /** Prescribed inter-set rest, in seconds. */
  rest_seconds: number;
  /** Optional flag for warm-up sets (excluded from volume calculations). */
  is_warmup?: boolean;
  /** Optional tempo notation, e.g. "3-1-1-0" (eccentric-pause-concentric-pause). */
  tempo?: string;
}

// ---------------------------------------------------------------------------
// ProgrammedExercise
// ---------------------------------------------------------------------------

/**
 * An exercise as it appears within a session. References the global
 * exercise library by `exercise_id` but caches `exercise_name` for
 * offline-first PWA rendering.
 *
 * Exercises sharing the same non-null `superset_id` are performed
 * back-to-back with no rest between them (rest only applies after the
 * final exercise in the group).
 */
export interface ProgrammedExercise {
  id: UUID;
  /** Foreign key into the exercise library (movements, FMS-screened patterns). */
  exercise_id: UUID;
  /** Denormalized name for offline rendering and program duplication. */
  exercise_name: string;
  /** 0-indexed position within the session. */
  order: number;
  /**
   * Optional grouping ID. Exercises sharing this ID form a superset/giant set.
   * Convention: A1/A2 supersets share one superset_id; B1/B2 share another.
   */
  superset_id?: UUID;
  sets: ProgrammedSet[];
  /** Coaching cues, technique notes, regression/progression options. */
  coach_notes?: string;
}

// ---------------------------------------------------------------------------
// Session (Training Day)
// ---------------------------------------------------------------------------

/**
 * A single training day within a microcycle (e.g. "Lower Body Heavy",
 * "Upper Push", "Conditioning").
 */
export interface Session {
  id: UUID;
  name: string;
  /** 0-indexed position within the week (0 = first training day). */
  order: number;
  exercises: ProgrammedExercise[];
  /** Optional session-level focus or theme. */
  focus?: string;
  /** Estimated session duration in minutes (auto-calculated downstream). */
  estimated_duration_minutes?: number;
}

// ---------------------------------------------------------------------------
// Microcycle (Week)
// ---------------------------------------------------------------------------

/**
 * One week of training. The `order` field is 1-indexed to match coaching
 * vernacular ("Week 1, Week 2..."). A typical block has 3-6 microcycles
 * with the final week being a deload.
 */
export interface Microcycle {
  id: UUID;
  /** 1-indexed week number within the block. */
  order: number;
  sessions: Session[];
  /** Optional flag for deload/recovery weeks. */
  is_deload?: boolean;
}

// ---------------------------------------------------------------------------
// ProgramBlock (Macrocycle)
// ---------------------------------------------------------------------------

/**
 * Top-level training program assigned to an athlete. A "block" in
 * block-periodization terminology — a contiguous training phase with a
 * unified goal (e.g. a 4-week hypertrophy block).
 */
export interface ProgramBlock {
  id: UUID;
  name: string;
  goal: ProgramGoal;
  /** Foreign key to the athlete this block is prescribed for. */
  athlete_id: UUID;
  start_date: ISODateString;
  weeks: Microcycle[];
  /** Optional coach-level description / rationale visible to the athlete. */
  description?: string;
  /** Last-modified timestamp for sync conflict resolution. */
  updated_at?: ISODateString;
}

// ---------------------------------------------------------------------------
// Helper / partial types (used by the store actions)
// ---------------------------------------------------------------------------

/**
 * Patch object for updating a ProgrammedSet. All fields optional — only
 * provided fields are merged.
 */
export type ProgrammedSetUpdate = Partial<Omit<ProgrammedSet, "id" | "set_number">>;

/**
 * Shape required to add a new exercise to a session. The store assigns
 * `id` and `order` automatically.
 */
export type NewProgrammedExercise = Omit<ProgrammedExercise, "id" | "order"> & {
  /** Optional client-provided ID; otherwise generated by the store. */
  id?: UUID;
};
