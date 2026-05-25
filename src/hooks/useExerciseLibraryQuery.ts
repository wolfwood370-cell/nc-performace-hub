/**
 * useExerciseLibraryQuery
 * ---------------------------------------------------------------------------
 * React Query hook that fetches the coach's exercise library from Supabase
 * with server-side text filtering.
 *
 * Schema notes
 * ------------
 * The `exercises` table does NOT have `muscle_group` or `equipment` columns
 * in the live schema. The actual columns we read are:
 *
 *   id              UUID
 *   coach_id        UUID    (RLS: coach_id = auth.uid())
 *   name            TEXT
 *   muscles         TEXT[]  (e.g. ['quadriceps','glutes'])
 *   movement_pattern TEXT?  (e.g. 'squat','hinge','push','pull')
 *   default_rpe     SMALLINT?
 *   is_compound     BOOLEAN
 *   archived        BOOLEAN (filtered out by default)
 *
 * To stay aligned with the V2 engine's `LibraryExerciseDef` shape (used by
 * `ExerciseLibraryDrawer`) we project an `equipment`-shaped field from
 * `movement_pattern` and a `muscle_group` field from `muscles[0]`. If/when
 * the DB grows real columns for those, only `mapRow` needs to change — the
 * public `LibraryExercise` type stays stable.
 *
 * Filter strategy
 * ---------------
 * We filter server-side via `.or(...)` combining:
 *   - `name ILIKE %q%`              (case-insensitive name match)
 *   - `muscles CS {q}`              (array contains — only used for exact
 *                                     muscle hits like "chest" or "glutes")
 *
 * Server-side filtering keeps the payload small even when a coach has
 * thousands of exercises. We always exclude `archived = true`.
 *
 * Performance
 * -----------
 * - Debounce the `searchQuery` input on the call site (~250ms) before
 *   passing it here. This hook does NOT debounce internally — debouncing
 *   is a UI concern, not a data concern.
 * - `staleTime: 5 minutes` because the library changes rarely; coaches
 *   editing the library directly should invalidate the query manually.
 * - `placeholderData: keepPreviousData` so the list doesn't flash empty
 *   while the user is typing.
 */

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Shape consumed by the program-builder UI. Stable across DB schema
 * changes — only `mapRow` below needs to evolve when the schema grows.
 */
export interface LibraryExercise {
  id: string;
  name: string;
  /** Primary muscle, derived from `muscles[0]` for now. */
  muscle_group: string;
  /** Equipment-ish descriptor. Sourced from `movement_pattern` until the
   *  DB grows a real `equipment` column. May be empty string. */
  equipment: string;
  /** Raw multi-muscle array — useful for richer filtering downstream. */
  muscles: string[];
  /** Coach default; helps the drawer prefill set RPE targets. */
  default_rpe: number | null;
  is_compound: boolean;
}

export interface UseExerciseLibraryQueryOptions {
  /**
   * Free-text search. Matched server-side against `name` (ILIKE) and
   * `muscles` (array contains). Empty string returns the unfiltered list.
   */
  searchQuery?: string;
  /** Disable the query entirely (e.g. while a parent drawer is closed). */
  enabled?: boolean;
  /** Cap rows returned. Defaults to 100 — plenty for a single drawer view. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/** Columns we actually need. Keep this tight — every byte counts on PWA.
 *  NOTE: live `exercises` schema has no `is_compound` column; we derive it
 *  from `exercise_type` ('Multi-articolare' === compound). */
const SELECT_COLS = "id, name, muscles, movement_pattern, default_rpe, exercise_type";

/** Row shape returned by Supabase given SELECT_COLS. */
interface ExerciseRow {
  id: string;
  name: string;
  muscles: string[] | null;
  movement_pattern: string | null;
  default_rpe: number | null;
  exercise_type: string | null;
}

/** Project a raw DB row into the UI-facing LibraryExercise shape. */
function mapRow(row: ExerciseRow): LibraryExercise {
  const muscles = row.muscles ?? [];
  return {
    id: row.id,
    name: row.name,
    muscle_group: muscles[0] ?? "—",
    equipment: row.movement_pattern ?? "",
    muscles,
    default_rpe: row.default_rpe,
    is_compound: row.exercise_type === "Multi-articolare",
  };
}

/**
 * Escape PostgREST wildcard chars so a search for "50%" or "_press" is
 * treated literally, not as ILIKE wildcards.
 */
function escapeIlike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch (and live-filter) the coach's exercise library.
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debounced = useDebounce(search, 250);
 * const { data: exercises = [], isLoading, error } =
 *   useExerciseLibraryQuery({ searchQuery: debounced });
 */
export function useExerciseLibraryQuery({
  searchQuery = "",
  enabled = true,
  limit = 100,
}: UseExerciseLibraryQueryOptions = {}): UseQueryResult<LibraryExercise[], Error> {
  const trimmed = searchQuery.trim();

  return useQuery<LibraryExercise[], Error>({
    queryKey: ["exercise-library", trimmed, limit],
    queryFn: async () => {
      // Build the base query. RLS scopes to the authenticated coach;
      // we still filter `archived = false` for soft-delete hygiene.
      let query = supabase
        .from("exercises")
        .select(SELECT_COLS)
        .eq("archived", false)
        .order("name", { ascending: true })
        .limit(limit);

      if (trimmed.length > 0) {
        const safe = escapeIlike(trimmed);
        // PostgREST `.or()` accepts a comma-separated filter expression.
        // `cs.{value}` = "contains" for array columns (case-sensitive on
        // the array element, but most muscle tags are stored lowercase).
        query = query.or(`name.ilike.%${safe}%,muscles.cs.{${trimmed.toLowerCase()}}`);
      }

      const { data, error } = await query;

      if (error) {
        // Re-throw as a real Error so React Query's error boundary path
        // works and consumers get a stable `error.message`.
        throw new Error(`Failed to load exercise library: ${error.message}`);
      }

      return ((data ?? []) as ExerciseRow[]).map(mapRow);
    },
    enabled,
    // Keep previous results visible while the user types — avoids the
    // "list flashes empty for 200ms" flicker that breaks keyboard flow.
    placeholderData: keepPreviousData,
    // Library changes infrequently; mutations on the library should
    // invalidate ['exercise-library'] explicitly.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Network failures shouldn't lock the drawer — one retry is enough.
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Cache-key helper (exported for invalidation from mutation hooks)
// ---------------------------------------------------------------------------

/**
 * Build a partial query key for invalidation. Pass to
 * `queryClient.invalidateQueries({ queryKey: exerciseLibraryQueryKey() })`
 * after creating/editing/archiving an exercise.
 */
const exerciseLibraryQueryKey = () => ["exercise-library"] as const;
