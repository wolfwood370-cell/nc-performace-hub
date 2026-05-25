/**
 * src/types/movement.ts
 * ---------------------------------------------------------------------------
 * Clinical domain model for the Functional Movement Screen (FMS) and
 * pain-tracking subsystem ("Red Flags") used by the Coach's on-floor
 * assessment workflow.
 *
 * Background
 * ----------
 * The FMS (Cook, Burton, Hoogenboom — 2006) is a 7-test screen that scores
 * fundamental movement patterns on an ordinal 0–3 scale, plus 3 binary
 * "clearing tests" that gate certain patterns by the presence of provocative
 * pain. The composite score is the sum of the seven movement-pattern
 * scores (max 21).
 *
 * Two clinical rules govern composite scoring and are encoded here:
 *
 *   1. ASYMMETRY RULE — for any test scored bilaterally (Hurdle Step,
 *      Inline Lunge, Shoulder Mobility, ASLR, Rotary Stability), the
 *      pattern's contribution to the composite is the LOWER of the two
 *      sides. The asymmetry itself (delta L vs R) is preserved as raw
 *      data because it is independently predictive of injury risk.
 *
 *   2. CLEARING-TEST OVERRIDE — if a clearing test elicits pain, the
 *      gated pattern's score becomes 0 regardless of the raw movement
 *      score. The mappings are:
 *         Shoulder Mobility ── gated by ── Shoulder Impingement Clearing
 *         Trunk Stability   ── gated by ── Spinal Extension Clearing
 *         Rotary Stability  ── gated by ── Spinal Flexion Clearing
 *
 * NOTE on schema coexistence
 * --------------------------
 * The legacy `fms_tests` table (flat-column, see migration
 * 20260110093015) is still consumed by alerting hooks (`useFmsAlerts`,
 * `useAthleteHealthProfile`). This file introduces the richer
 * `FmsAssessment` document model that will back the new
 * `fms_assessments` table — both can coexist while we migrate.
 */

// ---------------------------------------------------------------------------
// Primitive aliases
// ---------------------------------------------------------------------------

/** Branded UUID — kept aligned with `src/types/training.ts`. */
export type UUID = string;

/** ISO-8601 date string (YYYY-MM-DD). No time component. */
export type ISODate = string;

/** ISO-8601 timestamp (with timezone). */
export type ISOTimestamp = string;

// ---------------------------------------------------------------------------
// Score primitives
// ---------------------------------------------------------------------------

/**
 * The four legal raw FMS scores. Encoded as a literal union (not just
 * `number`) so the type system catches accidental 4s, -1s, or NaN.
 *
 *   0 — pain elicited during the movement (or clearing-test override)
 *   1 — unable to perform the pattern as described
 *   2 — performs with compensation
 *   3 — performs the pattern as described, no compensation
 */
export type FmsScore = 0 | 1 | 2 | 3;

/**
 * "Not yet scored" sentinel. We deliberately use `null` (not `undefined`)
 * because the assessment session is a structured form — every test has a
 * slot, and a slot is either filled (FmsScore) or explicitly empty (null).
 * `undefined` is reserved for "this field doesn't exist on this object",
 * which is a different concern.
 */
export type NullableScore = FmsScore | null;

/** The two sides for asymmetrical tests. */
export type Side = "left" | "right";

// ---------------------------------------------------------------------------
// Test catalog
// ---------------------------------------------------------------------------

/**
 * Stable identifiers for the 7 foundational FMS tests. snake_case to
 * match DB column conventions and the existing `useFmsAlerts` config.
 *
 * Bilateral (single score):
 *   - deep_squat
 *   - trunk_stability_pushup
 *
 * Asymmetrical (per-side score, composite = min(L, R)):
 *   - hurdle_step
 *   - inline_lunge
 *   - shoulder_mobility
 *   - active_straight_leg_raise
 *   - rotary_stability
 */
export type FmsTestId =
  | "deep_squat"
  | "hurdle_step"
  | "inline_lunge"
  | "shoulder_mobility"
  | "active_straight_leg_raise"
  | "trunk_stability_pushup"
  | "rotary_stability";

/**
 * Stable identifiers for the 3 binary clearing tests. Each gates exactly
 * one movement pattern (see CLEARING_GATE below).
 */
export type ClearingTestId =
  | "shoulder_impingement" // gates shoulder_mobility
  | "spinal_extension" // gates trunk_stability_pushup
  | "spinal_flexion"; // gates rotary_stability

/** Discriminator: how is this test scored? */
type TestKind = "bilateral" | "asymmetrical";

/**
 * Static metadata for a single FMS test. This is a *catalog* entry — the
 * runtime score lives in `FmsTestResult` below.
 */
export interface FmsTestDefinition {
  id: FmsTestId;
  /** Coach-facing display name (Italian — matches existing UX language). */
  displayName: string;
  /** Internal English name for logs / analytics. */
  canonicalName: string;
  kind: TestKind;
  /** The body region this test loads — used for risk-flag routing. */
  bodyArea: string;
  /**
   * Clearing test that overrides this pattern's score to 0 when positive.
   * `null` for tests that have no gating clearing test (e.g. deep squat).
   */
  gatedBy: ClearingTestId | null;
  /** Brief clinical description of the optimal pattern (for the on-floor cheat-sheet). */
  description: string;
}

/**
 * Static metadata for a clearing test.
 */
export interface ClearingTestDefinition {
  id: ClearingTestId;
  displayName: string;
  canonicalName: string;
  /** Which movement pattern this clearing test gates. */
  gates: FmsTestId;
  /** Description of the provocative maneuver. */
  description: string;
}

// ---------------------------------------------------------------------------
// Test catalog — single source of truth
// ---------------------------------------------------------------------------

/**
 * The full 7-test catalog. Order is the canonical FMS administration
 * order (deep squat first, rotary stability last). Treat as readonly.
 */
export const FMS_TESTS: readonly FmsTestDefinition[] = [
  {
    id: "deep_squat",
    displayName: "Deep Squat",
    canonicalName: "Deep Squat",
    kind: "bilateral",
    bodyArea: "Lower Body — Bilateral",
    gatedBy: null,
    description:
      "Symmetrical, functional mobility of the hips, knees, and ankles. Dowel held overhead, feet shoulder-width, descend to thighs below parallel.",
  },
  {
    id: "hurdle_step",
    displayName: "Hurdle Step",
    canonicalName: "Hurdle Step",
    kind: "asymmetrical",
    bodyArea: "Hip — Stride Stance",
    gatedBy: null,
    description:
      "Step-up over a hurdle at tibial-tuberosity height. Tests single-leg stance stability and stepping-leg hip mobility.",
  },
  {
    id: "inline_lunge",
    displayName: "Inline Lunge",
    canonicalName: "Inline Lunge",
    kind: "asymmetrical",
    bodyArea: "Hip / Knee — Split Stance",
    gatedBy: null,
    description:
      "Tandem-stance lunge on a 2x6 board. Tests hip and ankle mobility, quadriceps flexibility, and knee/ankle stability.",
  },
  {
    id: "shoulder_mobility",
    displayName: "Shoulder Mobility",
    canonicalName: "Shoulder Mobility Reaching",
    kind: "asymmetrical",
    bodyArea: "Shoulder Girdle",
    gatedBy: "shoulder_impingement",
    description:
      "Reciprocal shoulder mobility — one fist behind back overhead, other fist behind back below. Measure inter-fist distance vs. hand length.",
  },
  {
    id: "active_straight_leg_raise",
    displayName: "Active Straight Leg Raise",
    canonicalName: "Active Straight Leg Raise",
    kind: "asymmetrical",
    bodyArea: "Posterior Chain / Hip Disassociation",
    gatedBy: null,
    description:
      "Supine leg raise with opposite leg flat. Tests active hamstring & gastroc-soleus flexibility while maintaining stable pelvis.",
  },
  {
    id: "trunk_stability_pushup",
    displayName: "Trunk Stability Pushup",
    canonicalName: "Trunk Stability Pushup",
    kind: "bilateral",
    bodyArea: "Anterior Core — Sagittal Stability",
    gatedBy: "spinal_extension",
    description:
      "Pushup from a prone position with thumbs aligned to forehead (M) / chin (F). Body rises as a single unit — no lumbar sag.",
  },
  {
    id: "rotary_stability",
    displayName: "Rotary Stability",
    canonicalName: "Rotary Stability",
    kind: "asymmetrical",
    bodyArea: "Multi-plane Core Stability",
    gatedBy: "spinal_flexion",
    description:
      "Quadruped same-side arm/leg extension. Tests multi-planar pelvic, core, and shoulder-girdle stability.",
  },
] as const;

/**
 * The 3 clearing tests. These are pass/fail (binary pain elicitation) —
 * a positive result forces the gated pattern's composite score to 0.
 */
export const FMS_CLEARING_TESTS: readonly ClearingTestDefinition[] = [
  {
    id: "shoulder_impingement",
    displayName: "Shoulder Impingement Clearing",
    canonicalName: "Shoulder Impingement Clearing Test",
    gates: "shoulder_mobility",
    description:
      "Hand to opposite shoulder, actively raise the elbow. Pain in the anterior shoulder/AC joint = positive.",
  },
  {
    id: "spinal_extension",
    displayName: "Spinal Extension Clearing",
    canonicalName: "Press-Up / Prone Extension Clearing",
    gates: "trunk_stability_pushup",
    description:
      "From a pushup position, press into a prone press-up (cobra). Low-back pain on extension = positive.",
  },
  {
    id: "spinal_flexion",
    displayName: "Spinal Flexion Clearing",
    canonicalName: "Quadruped Flexion Clearing",
    gates: "rotary_stability",
    description:
      "From quadruped, rock the hips back to the heels and reach forward (child's pose). Pain on flexion = positive.",
  },
] as const;

/**
 * Lookup map: which clearing test gates which movement pattern. Used by
 * the scoring engine to apply the pain → 0 override.
 *
 * Keys are the gated `FmsTestId`. Values are the gating `ClearingTestId`.
 * Patterns with no gate are simply absent from the map.
 */
export const CLEARING_GATE: Readonly<Partial<Record<FmsTestId, ClearingTestId>>> = {
  shoulder_mobility: "shoulder_impingement",
  trunk_stability_pushup: "spinal_extension",
  rotary_stability: "spinal_flexion",
} as const;

// ---------------------------------------------------------------------------
// Per-test result shapes (discriminated union)
// ---------------------------------------------------------------------------

/**
 * Result for a bilateral test (Deep Squat, Trunk Stability Pushup).
 * A single raw score covers both sides since the movement is symmetrical.
 *
 * `painElicited` is captured separately from the score because in some
 * clinics a 1 is recorded *because of* pain — we want the underlying
 * cause for downstream rehab routing. Note that for tests gated by a
 * clearing test, pain is also surfaced through the clearing-test result;
 * the boolean here is for pain on the *primary* movement.
 */
interface BilateralTestResult {
  testId: FmsTestId;
  kind: "bilateral";
  score: NullableScore;
  painElicited: boolean;
  /** Free-form clinician note (max ~500 chars enforced upstream). */
  notes?: string;
}

/**
 * Result for an asymmetrical test (Hurdle Step, Inline Lunge, Shoulder
 * Mobility, ASLR, Rotary Stability). Raw L/R scores are preserved — the
 * composite (min of L,R) is computed at read time, never stored, so the
 * asymmetry signal is never lost.
 */
interface AsymmetricalTestResult {
  testId: FmsTestId;
  kind: "asymmetrical";
  leftScore: NullableScore;
  rightScore: NullableScore;
  painElicited: boolean;
  notes?: string;
}

/** Discriminated union — narrow on `kind`. */
export type FmsTestResult = BilateralTestResult | AsymmetricalTestResult;

/** Result of a single clearing test. Binary by design. */
export interface ClearingTestResult {
  clearingTestId: ClearingTestId;
  /** True ⇒ pain was elicited ⇒ gated pattern composite forced to 0. */
  hasPain: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Red Flag (pain occurrence) tracking
// ---------------------------------------------------------------------------

/** 0–10 NRS (Numeric Rating Scale) — clinical standard for pain intensity. */
type PainSeverity = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Provenance of a red flag — where the pain was reported. Distinguishing
 * these is important because pain elicited by a screening test (i.e. by
 * the clinician applying load) is a stronger contraindication signal
 * than self-reported background ache.
 */
type RedFlagSource =
  | "clearing_test" // pain on shoulder/spinal extension/spinal flexion clear
  | "movement_test" // pain during a foundational FMS test
  | "self_report"; // athlete-reported pain outside of testing

/**
 * Anatomical location coding — kept as an open string union so we can
 * extend without a migration. The first set is the recommended vocabulary;
 * UI-builder may add more, but should prefer existing values.
 */
type RedFlagBodyZone =
  | "cervical"
  | "thoracic"
  | "lumbar"
  | "sacroiliac"
  | "shoulder_left"
  | "shoulder_right"
  | "elbow_left"
  | "elbow_right"
  | "wrist_left"
  | "wrist_right"
  | "hip_left"
  | "hip_right"
  | "knee_left"
  | "knee_right"
  | "ankle_left"
  | "ankle_right"
  | "foot_left"
  | "foot_right"
  | "other"
  | (string & {}); // open extension — keeps autocomplete on the literals

/**
 * A single pain occurrence captured during (or alongside) the assessment.
 * Multiple red flags can be raised in one assessment session.
 */
export interface RedFlag {
  /** Stable client-generated ID — survives the round-trip to the DB. */
  id: UUID;
  source: RedFlagSource;
  /** Pointer to the originating test, when source is test-driven. */
  testId?: FmsTestId;
  clearingTestId?: ClearingTestId;
  /** For asymmetrical tests, which side reproduced the pain. */
  side?: Side;
  bodyZone: RedFlagBodyZone;
  severity: PainSeverity;
  /** Coach's free-text observation — quality, onset, mechanism. */
  notes?: string;
  /** When the flag was raised during the session. */
  raisedAt: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Composite scoring output (engine result, never persisted directly)
// ---------------------------------------------------------------------------

/**
 * The clinical "final score" payload — one row per test plus the total.
 * Returned by the store's `getFinalScore()` selector. Built fresh from
 * raw results on demand; never stored, so the source of truth (raw L/R
 * scores + clearing-test pain) is preserved.
 */
export interface FmsCompositeScore {
  /** Per-test composite (min of L,R for asymmetrical; raw for bilateral). */
  perTest: ReadonlyArray<{
    testId: FmsTestId;
    /** Final 0–3 score AFTER applying the clearing-test override. */
    score: NullableScore;
    /** True if score was forced to 0 by a positive clearing test. */
    overriddenByClearingTest: boolean;
    /** Asymmetry magnitude: |L − R|. Null for bilateral or incomplete tests. */
    asymmetry: number | null;
  }>;
  /** Sum of per-test scores. Null if any test is unscored. */
  total: number | null;
  /** Maximum possible composite (always 21 for the 7-test FMS). */
  maxTotal: 21;
  /** Whether every test has been scored AND every gating clearing test answered. */
  isComplete: boolean;
  /** Convenience: are any tests at score 0 or 1? Used for "needs rehab" routing. */
  hasRedFlags: boolean;
  /** Convenience: are any asymmetries ≥ 1 score-point? */
  hasAsymmetry: boolean;
}

// ---------------------------------------------------------------------------
// Aggregate: a complete assessment document
// ---------------------------------------------------------------------------

/**
 * The serializable, persistence-ready FMS assessment. This is exactly
 * what gets shipped to the `fms_assessments` table (see
 * `useSaveAssessment.ts` for the SQL schema).
 *
 * Design notes
 * ------------
 * - `id` is generated client-side (uuid v4) so the on-floor flow is
 *   offline-safe.
 * - `tests` is keyed by `FmsTestId` (object map), not an array. Forces
 *   exactly-one result per test and gives O(1) lookup in the engine.
 * - `clearingTests` is similarly keyed.
 * - `redFlags` is an array because cardinality is open (an athlete can
 *   raise multiple pain flags in one session).
 * - `compositeTotal` is denormalized into the row at save-time so the
 *   coach dashboard can list/sort assessments without re-running the
 *   engine for each one. The full payload still wins for any UI that
 *   needs detail.
 */
export interface FmsAssessment {
  id: UUID;
  athleteId: UUID;
  coachId: UUID;
  /** Date of administration — separate from `createdAt` (which records insertion time). */
  assessmentDate: ISODate;
  /** Per-test results, keyed by the canonical test id. */
  tests: Readonly<Record<FmsTestId, FmsTestResult>>;
  /** Clearing-test results, keyed by clearing-test id. */
  clearingTests: Readonly<Record<ClearingTestId, ClearingTestResult>>;
  /** All pain occurrences raised during the session. */
  redFlags: ReadonlyArray<RedFlag>;
  /** Denormalized composite total for fast list views. Mirrors `getFinalScore().total`. */
  compositeTotal: number | null;
  /** Whether the assessment was completed in full (all tests scored). */
  isComplete: boolean;
  /** Coach's overall session note — separate from per-test notes. */
  generalNotes?: string;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/**
 * Input shape for creating a brand-new assessment session in the store.
 * Distinct from `FmsAssessment` because the persistence-bound fields
 * (`id`, `createdAt`, `updatedAt`, `compositeTotal`, `isComplete`) are
 * derived, not user-provided.
 */
export interface NewAssessmentInput {
  athleteId: UUID;
  coachId: UUID;
  assessmentDate?: ISODate; // defaults to today
}
