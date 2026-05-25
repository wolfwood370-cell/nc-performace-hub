/**
 * src/stores/useMovementStore.ts
 * ---------------------------------------------------------------------------
 * Zustand store managing an active "Assessment Session" — the in-memory,
 * on-the-gym-floor state while a coach is screening an athlete.
 *
 * Responsibilities
 * ----------------
 * 1. Hold the current draft `FmsAssessment` (athlete identity, raw scores,
 *    clearing-test pain flags, red flags, notes).
 * 2. Expose narrow, intent-revealing actions for the UI to mutate scores
 *    without ever touching internal shape (e.g. `setScore`, not "patch the
 *    `tests` map directly").
 * 3. Expose pure selectors for derived clinical values — the FMS composite
 *    score with all its rules (asymmetry minimum, clearing-test override).
 *
 * Non-responsibilities
 * --------------------
 * - Persistence. The store is intentionally NOT persisted to localStorage:
 *   an assessment is a coach-supervised, single-session interaction; if
 *   the page is closed, the coach restarts the screen rather than risk
 *   submitting stale clinical data. Persistence to Supabase happens
 *   exclusively via `useSaveAssessment`.
 * - Authentication / authorization. The hook layer wires `coachId` from
 *   `useAuth`; the store just stores what it's told.
 *
 * Design notes
 * ------------
 * - Uses Zustand 5 + immer middleware (consistent with
 *   `useProgramBuilderStore`).
 * - State is initialized empty; `startAssessment(input)` boots a session
 *   with defaults so every test slot exists from the start (predictable
 *   map keys ⇒ no need for the UI to handle missing keys).
 * - The clinical math (asymmetry minimum, clearing-test override) lives
 *   in the `getFinalScore` selector and the standalone helpers below it,
 *   which are exported for unit-testing.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  FMS_TESTS,
  FMS_CLEARING_TESTS,
  CLEARING_GATE,
  type FmsAssessment,
  type FmsCompositeScore,
  type FmsTestId,
  type FmsTestResult,
  type FmsScore,
  type NullableScore,
  type ClearingTestId,
  type ClearingTestResult,
  type RedFlag,
  type Side,
  type NewAssessmentInput,
  type ISODate,
  type ISOTimestamp,
  type UUID,
} from "@/types/movement";

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

/** UUID generator with a non-crypto fallback (mirrors `useProgramBuilderStore`). */
const uuid = (): UUID => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const todayISODate = (): ISODate => new Date().toISOString().slice(0, 10);
const nowISO = (): ISOTimestamp => new Date().toISOString();

/**
 * Build the empty `tests` map — one slot per FMS test, with the right
 * discriminator. Keeping this centralized means the UI can always trust
 * that `state.assessment.tests[testId]` exists.
 */
function buildEmptyTestsMap(): Record<FmsTestId, FmsTestResult> {
  // Cast through unknown — we fill every key in the loop below, so the
  // final shape satisfies the Record. TypeScript can't follow the
  // narrowing of literals across an array .reduce, hence the assertion.
  const map = {} as Record<FmsTestId, FmsTestResult>;
  for (const def of FMS_TESTS) {
    if (def.kind === "bilateral") {
      map[def.id] = {
        testId: def.id,
        kind: "bilateral",
        score: null,
        painElicited: false,
      };
    } else {
      map[def.id] = {
        testId: def.id,
        kind: "asymmetrical",
        leftScore: null,
        rightScore: null,
        painElicited: false,
      };
    }
  }
  return map;
}

/** Build the empty clearing-test map — all unanswered, all "no pain". */
function buildEmptyClearingMap(): Record<ClearingTestId, ClearingTestResult> {
  const map = {} as Record<ClearingTestId, ClearingTestResult>;
  for (const def of FMS_CLEARING_TESTS) {
    map[def.id] = {
      clearingTestId: def.id,
      hasPain: false,
    };
  }
  return map;
}

// ---------------------------------------------------------------------------
// Pure scoring engine — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Compute the per-test composite score, applying both clinical rules:
 *
 *   1. Asymmetrical tests: composite = min(leftScore, rightScore).
 *      If EITHER side is unscored (null), the composite is null —
 *      a half-scored asymmetrical test is incomplete, not "scored as
 *      whatever's available". This protects against silently emitting
 *      an artificially high composite.
 *
 *   2. Clearing-test override: if the test is gated by a clearing test
 *      AND that clearing test returned positive (hasPain === true), the
 *      composite is forced to 0 regardless of raw movement score.
 *
 * Returns `null` if the test is incompletely scored, `0..3` otherwise.
 */
export function computeTestComposite(
  test: FmsTestResult,
  clearingTests: Readonly<Record<ClearingTestId, ClearingTestResult>>,
): NullableScore {
  // ── Rule 2 evaluated first: a positive clearing test forces 0 even if
  //    the underlying movement was never scored. Clinically this is correct:
  //    pain on the clearing test is itself a pattern fault.
  const gate = CLEARING_GATE[test.testId];
  if (gate && clearingTests[gate]?.hasPain === true) {
    return 0;
  }

  // ── Rule 1: composite from the raw score(s).
  if (test.kind === "bilateral") {
    return test.score;
  }

  // Asymmetrical — both sides must be scored to derive a composite.
  if (test.leftScore === null || test.rightScore === null) {
    return null;
  }
  return Math.min(test.leftScore, test.rightScore) as FmsScore;
}

/**
 * Asymmetry magnitude for an asymmetrical test: |L − R|. Returns `null`
 * for bilateral tests (no asymmetry concept) and for any asymmetrical
 * test where either side is unscored.
 */
export function computeAsymmetry(test: FmsTestResult): number | null {
  if (test.kind !== "asymmetrical") return null;
  if (test.leftScore === null || test.rightScore === null) return null;
  return Math.abs(test.leftScore - test.rightScore);
}

/**
 * Build the full `FmsCompositeScore` summary for a draft assessment.
 *
 * Completeness logic:
 *   - Every test must have a non-null composite (i.e. fully scored or
 *     overridden to 0 by a clearing test).
 *   - Note: clearing tests themselves don't need to be "answered" — the
 *     default is `hasPain: false`, which the coach is expected to
 *     explicitly toggle if pain is present. (The UI should make this
 *     unmissable, but at the data layer we trust the default.)
 */
export function computeCompositeScore(
  tests: Readonly<Record<FmsTestId, FmsTestResult>>,
  clearingTests: Readonly<Record<ClearingTestId, ClearingTestResult>>,
): FmsCompositeScore {
  const perTest = FMS_TESTS.map((def) => {
    const result = tests[def.id];
    const score = computeTestComposite(result, clearingTests);
    const gate = CLEARING_GATE[def.id];
    const overriddenByClearingTest = !!gate && clearingTests[gate]?.hasPain === true;
    return {
      testId: def.id,
      score,
      overriddenByClearingTest,
      asymmetry: computeAsymmetry(result),
    };
  });

  const allScored = perTest.every((row) => row.score !== null);
  // `total` only when every test is scored — partial sums are misleading.
  const total = allScored ? perTest.reduce((sum, row) => sum + (row.score ?? 0), 0) : null;

  const hasRedFlags = perTest.some((row) => row.score !== null && row.score <= 1);
  const hasAsymmetry = perTest.some((row) => row.asymmetry !== null && row.asymmetry >= 1);

  return {
    perTest,
    total,
    maxTotal: 21,
    isComplete: allScored,
    hasRedFlags,
    hasAsymmetry,
  };
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

/**
 * The "draft" assessment held in memory during a session. It mirrors
 * `FmsAssessment` but with the fields that only matter at persistence
 * time made nullable / omitted. The store materializes a full
 * `FmsAssessment` on `serialize()` for the save hook.
 */
interface DraftAssessment {
  id: UUID;
  athleteId: UUID;
  coachId: UUID;
  assessmentDate: ISODate;
  tests: Record<FmsTestId, FmsTestResult>;
  clearingTests: Record<ClearingTestId, ClearingTestResult>;
  redFlags: RedFlag[];
  generalNotes: string;
  /** When the session was started — used to populate `createdAt` on save. */
  startedAt: ISOTimestamp;
}

interface MovementState {
  /** The active assessment, or null if no session is in progress. */
  assessment: DraftAssessment | null;
  /** Set true on any mutating action; cleared by `resetAssessment`. */
  isDirty: boolean;
}

interface MovementActions {
  // ── Session lifecycle ──────────────────────────────────────────────
  /** Boot a fresh assessment session for the given athlete/coach pair. */
  startAssessment: (input: NewAssessmentInput) => void;
  /** Replace the current draft (e.g. when loading an existing assessment to edit). */
  loadAssessment: (assessment: FmsAssessment) => void;
  /** Discard the current draft and clear the dirty flag. */
  resetAssessment: () => void;

  // ── Score mutations ────────────────────────────────────────────────
  /**
   * Set a test score. The `side` argument is required for asymmetrical
   * tests and ignored for bilateral tests — passing the wrong shape is
   * a no-op (defensive: we don't want a test misuse to corrupt state).
   *
   * @param testId - which of the 7 FMS tests
   * @param side   - 'left' | 'right' for asymmetrical, anything for bilateral
   * @param score  - 0–3 raw score, or null to clear
   */
  setScore: (testId: FmsTestId, side: Side | null, score: NullableScore) => void;

  /** Toggle the "pain elicited on the primary movement" flag for a test. */
  setTestPain: (testId: FmsTestId, painElicited: boolean) => void;

  /** Update the per-test free-form clinician note. */
  setTestNotes: (testId: FmsTestId, notes: string) => void;

  // ── Clearing-test mutations ────────────────────────────────────────
  /**
   * Record a clearing-test result. When `hasPain === true`, the gated
   * pattern's composite drops to 0 automatically (handled by the
   * selector — no other state change needed).
   */
  setClearingTestPain: (testId: ClearingTestId, hasPain: boolean) => void;

  setClearingTestNotes: (testId: ClearingTestId, notes: string) => void;

  // ── Red flags ──────────────────────────────────────────────────────
  /** Append a red flag. Returns the generated id so the UI can reference it. */
  addRedFlag: (flag: Omit<RedFlag, "id" | "raisedAt">) => UUID;
  removeRedFlag: (id: UUID) => void;

  // ── Notes ──────────────────────────────────────────────────────────
  setGeneralNotes: (notes: string) => void;

  // ── Selectors / serialization ──────────────────────────────────────
  /**
   * Compute the full composite score for the current draft. Read-only
   * and cheap; safe to call from render. Callers should NOT memoize in
   * a useMemo — re-running this is fine.
   */
  getFinalScore: () => FmsCompositeScore | null;

  /**
   * Materialize the current draft into a fully-formed `FmsAssessment`
   * suitable for `useSaveAssessment.mutate(...)`. Returns null if there
   * is no active session.
   */
  serialize: () => FmsAssessment | null;
}

export type MovementStore = MovementState & MovementActions;

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

const initialState: MovementState = {
  assessment: null,
  isDirty: false,
};

export const useMovementStore = create<MovementStore>()(
  immer((set, get) => ({
    ...initialState,

    // ── Lifecycle ────────────────────────────────────────────────────
    startAssessment: ({ athleteId, coachId, assessmentDate }) => {
      set((state) => {
        state.assessment = {
          id: uuid(),
          athleteId,
          coachId,
          assessmentDate: assessmentDate ?? todayISODate(),
          tests: buildEmptyTestsMap(),
          clearingTests: buildEmptyClearingMap(),
          redFlags: [],
          generalNotes: "",
          startedAt: nowISO(),
        };
        state.isDirty = false;
      });
    },

    loadAssessment: (assessment) => {
      set((state) => {
        state.assessment = {
          id: assessment.id,
          athleteId: assessment.athleteId,
          coachId: assessment.coachId,
          assessmentDate: assessment.assessmentDate,
          // Spread to drop readonly modifiers — immer needs writable drafts.
          tests: { ...assessment.tests },
          clearingTests: { ...assessment.clearingTests },
          redFlags: [...assessment.redFlags],
          generalNotes: assessment.generalNotes ?? "",
          startedAt: assessment.createdAt,
        };
        state.isDirty = false;
      });
    },

    resetAssessment: () => {
      set((state) => {
        state.assessment = null;
        state.isDirty = false;
      });
    },

    // ── Score mutations ──────────────────────────────────────────────
    setScore: (testId, side, score) => {
      set((state) => {
        const draft = state.assessment;
        if (!draft) return;

        const test = draft.tests[testId];
        if (!test) return; // unknown testId — defensive

        if (test.kind === "bilateral") {
          // Side is meaningless here; we deliberately ignore it rather
          // than throw, so a UI bug doesn't break the flow.
          test.score = score;
        } else {
          // Asymmetrical — `side` MUST be provided. If null, no-op.
          if (side === "left") test.leftScore = score;
          else if (side === "right") test.rightScore = score;
          // else: silently no-op (UI bug — log if you want to track this)
        }
        state.isDirty = true;
      });
    },

    setTestPain: (testId, painElicited) => {
      set((state) => {
        const test = state.assessment?.tests[testId];
        if (!test) return;
        test.painElicited = painElicited;
        state.isDirty = true;
      });
    },

    setTestNotes: (testId, notes) => {
      set((state) => {
        const test = state.assessment?.tests[testId];
        if (!test) return;
        test.notes = notes;
        state.isDirty = true;
      });
    },

    // ── Clearing-test mutations ──────────────────────────────────────
    setClearingTestPain: (testId, hasPain) => {
      set((state) => {
        const ct = state.assessment?.clearingTests[testId];
        if (!ct) return;
        ct.hasPain = hasPain;
        state.isDirty = true;
      });
    },

    setClearingTestNotes: (testId, notes) => {
      set((state) => {
        const ct = state.assessment?.clearingTests[testId];
        if (!ct) return;
        ct.notes = notes;
        state.isDirty = true;
      });
    },

    // ── Red flags ────────────────────────────────────────────────────
    addRedFlag: (flag) => {
      const id = uuid();
      set((state) => {
        if (!state.assessment) return;
        state.assessment.redFlags.push({
          ...flag,
          id,
          raisedAt: nowISO(),
        });
        state.isDirty = true;
      });
      return id;
    },

    removeRedFlag: (id) => {
      set((state) => {
        if (!state.assessment) return;
        state.assessment.redFlags = state.assessment.redFlags.filter((f) => f.id !== id);
        state.isDirty = true;
      });
    },

    // ── Notes ────────────────────────────────────────────────────────
    setGeneralNotes: (notes) => {
      set((state) => {
        if (!state.assessment) return;
        state.assessment.generalNotes = notes;
        state.isDirty = true;
      });
    },

    // ── Selectors ────────────────────────────────────────────────────
    getFinalScore: () => {
      const draft = get().assessment;
      if (!draft) return null;
      return computeCompositeScore(draft.tests, draft.clearingTests);
    },

    serialize: () => {
      const draft = get().assessment;
      if (!draft) return null;

      const composite = computeCompositeScore(draft.tests, draft.clearingTests);
      const now = nowISO();

      const assessment: FmsAssessment = {
        id: draft.id,
        athleteId: draft.athleteId,
        coachId: draft.coachId,
        assessmentDate: draft.assessmentDate,
        tests: draft.tests,
        clearingTests: draft.clearingTests,
        redFlags: draft.redFlags,
        compositeTotal: composite.total,
        isComplete: composite.isComplete,
        generalNotes: draft.generalNotes || undefined,
        createdAt: draft.startedAt,
        updatedAt: now,
      };
      return assessment;
    },
  })),
);

// ---------------------------------------------------------------------------
// Convenience selectors — opt-in, equality-stable
// ---------------------------------------------------------------------------

/** Read just the active assessment (or null). Stable reference under immer. */
export const selectAssessment = (s: MovementStore) => s.assessment;
/** Read the dirty flag — used by "leave page" guards. */
export const selectIsDirty = (s: MovementStore) => s.isDirty;
