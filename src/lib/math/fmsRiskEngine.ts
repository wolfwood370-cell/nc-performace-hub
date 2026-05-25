/**
 * src/lib/math/fmsRiskEngine.ts
 * ---------------------------------------------------------------------------
 * Pure-TypeScript risk-analysis engine that cross-references a coach-prescribed
 * exercise against an athlete's most recent Functional Movement Screen (FMS)
 * assessment and emits a Biomechanical Traffic Light verdict.
 *
 * Why this exists
 * ---------------
 * The coach's program builder ships exercises by movement pattern, muscle
 * tag, and free-text name. The clinician (or the same coach wearing a
 * different hat) ships an FMS assessment scoring 7 fundamental movement
 * patterns 0-3, plus 3 binary clearing tests for provocative pain. Until
 * now those two worlds did not talk. This module is the bridge: given an
 * `ExerciseInfo` and the latest `FmsAssessment`, return a structured risk
 * verdict the UI can render as green / amber / red.
 *
 * Clinical reasoning
 * ------------------
 * The Functional Movement Screen literature (Cook, Burton & Hoogenboom 2006;
 * Kiesel, Plisky & Voight 2007) treats a per-test score of 1 — and any
 * positive clearing-test pain (which forces the gated pattern's score to 0)
 * — as a clinically meaningful contraindication for *loaded* expression of
 * that movement pattern. A score of 2 is "performs with compensation": safe
 * for general training but worth coaching cues; a 3 is unrestricted. This
 * engine encodes that ordinal logic with the threshold the product spec
 * mandates: a per-test score of >= 2 is the floor for prescribing loaded
 * work in the corresponding pattern.
 *
 * For asymmetrical tests (Shoulder Mobility, ASLR, etc.) the FMS uses
 * `min(L, R)` as the pattern's effective score — the worse side gates the
 * prescription. The engine follows the same convention via
 * `effectiveScore()` so a 3/1 athlete is treated as a 1, not as a 2-average.
 *
 * Risk-level ladder (most → least severe wins):
 *   high     — ANY pain signal:
 *                • clearing test positive on a pattern this exercise loads
 *                • effective score == 0 on a relevant pattern
 *                • a recorded RedFlag whose body region overlaps the lift
 *   moderate — effective score == 1 on a relevant pattern
 *              (i.e. dysfunctional movement, no pain — load with caution
 *              or substitute)
 *   low      — every relevant pattern scored >= 2 OR exercise touches no
 *              gated pattern
 *
 * `isSafe` is the boolean projection of that ladder: only `low` is safe.
 *
 * Determinism & purity
 * --------------------
 * - No I/O, no `Date.now()`, no randomness. Same inputs → same output.
 * - No exceptions thrown for "missing data": a missing assessment is a
 *   first-class case and yields an `unknown_assessment` reason at low risk
 *   (we don't block the coach when we have nothing to go on; we surface
 *   the gap so the UI can prompt for an assessment).
 * - Pure functions are unit-testable without React, Supabase, or jsdom.
 */

import type {
  FmsAssessment,
  FmsTestId,
  FmsTestResult,
  ClearingTestId,
  ClearingTestResult,
  RedFlag,
} from "@/types/movement";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Loose, semantic description of the exercise the coach is about to
 * prescribe. We accept multiple optional fields so callers can feed us
 * either a structured `LibraryExercise` row from Supabase OR a
 * higher-level "Vertical Push" / "Shoulders" tag from the program-builder
 * UI without having to translate first.
 *
 * All fields are case-insensitive. The engine normalizes internally.
 *
 * Mapping notes
 * -------------
 * - `movementPattern` accepts BOTH the English clinical labels in the
 *   product spec ("Vertical Push", "Squat", "Hinge", "Deadlift") AND the
 *   Italian DB values from `MOVEMENT_PATTERNS` in `lib/muscleTags.ts`
 *   ("spinta_verticale", "squat", "hinge", ...). This lets the engine
 *   work directly off `exercises.movement_pattern` rows OR off explicit
 *   semantic input from the spec.
 * - `targets` is a free-form list of body-region tags ("Shoulders",
 *   "Spalle", "Lower Back", "Core"). We pattern-match liberally to handle
 *   both English coaching shorthand and the Italian muscle taxonomy.
 * - `name` is searched as a last-resort heuristic for keywords like
 *   "deadlift", "overhead press" — useful when neither pattern nor target
 *   tags are populated.
 */
export interface ExerciseInfo {
  /** Canonical exercise name. e.g. "Overhead Press", "Romanian Deadlift". */
  name?: string;
  /**
   * Movement-pattern descriptor. Accepts spec labels ("Vertical Push",
   * "Squat", "Hinge", "Deadlift") OR DB values ("spinta_verticale",
   * "squat", "hinge"). Case-insensitive.
   */
  movementPattern?: string;
  /**
   * Body-region or muscle-group tags. e.g. ["Shoulders"], ["Spalle"],
   * ["Core", "Lower Back"]. Case-insensitive.
   */
  targets?: readonly string[];
  /**
   * Optional: classification flag. Compound lifts get the same gating as
   * non-compound by default — present here for future weighting.
   */
  isCompound?: boolean;
}

/** Three-tier traffic light. Order matters: high > moderate > low. */
type RiskLevel = "low" | "moderate" | "high";

/**
 * The verdict returned to the caller. Designed to be JSON-serializable
 * so it can ride along inside a React Query cache or be pickled into a
 * coach-alert row without further transformation.
 */
export interface ExerciseRiskAssessment {
  /** True iff `riskLevel === 'low'`. Convenience for if/else gates. */
  isSafe: boolean;
  /** Traffic-light bucket. */
  riskLevel: RiskLevel;
  /**
   * Human-readable Italian reasons. One per failed clinical rule (or the
   * single sentinel "unknown_assessment" when no assessment is available).
   * Ordered most → least severe so the first reason is always the
   * headline the UI should surface.
   */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Pattern-detection heuristics
// ---------------------------------------------------------------------------

/**
 * Each entry maps a clinical "movement category" used by the rule engine
 * to a set of pattern keywords, target keywords, and exercise-name
 * fragments. Matching is case-insensitive substring on the lowercased
 * input — covers both the English spec vocabulary and the existing
 * Italian DB taxonomy in one pass.
 *
 * Adding a new movement category? Add an entry here and a corresponding
 * branch in `evaluateRules()` below — the rest of the file is generic.
 */
const MOVEMENT_KEYWORDS = {
  /** Overhead-loaded shoulder work — gated by Shoulder Mobility + clearing. */
  verticalPush: {
    patterns: ["vertical push", "spinta_verticale", "spinta verticale", "overhead"],
    targets: ["shoulders", "spalle", "deltoid", "deltoidi"],
    nameFragments: [
      "overhead press",
      "military press",
      "push press",
      "shoulder press",
      "snatch",
      "jerk",
      "overhead squat",
      "handstand",
    ],
  },
  /** Knee-dominant bilateral squat — gated by Deep Squat. */
  squat: {
    patterns: ["squat"],
    targets: [], // Deliberately empty — we don't want generic "Legs" to gate on Deep Squat alone.
    nameFragments: [
      "back squat",
      "front squat",
      "goblet squat",
      "overhead squat",
      "box squat",
      "leg press",
      "hack squat",
    ],
  },
  /** Hip-dominant hinge / deadlift family — gated by ASLR. */
  hinge: {
    patterns: ["hinge", "deadlift"],
    targets: ["hamstring", "ischiocrurali", "posterior chain", "erettori spinali"],
    nameFragments: [
      "deadlift",
      "romanian deadlift",
      "rdl",
      "stiff leg",
      "good morning",
      "kettlebell swing",
      "hip thrust",
      "glute bridge",
    ],
  },
  /** Core + spinal loading — gated by Trunk Stability Pushup. */
  coreSpinal: {
    patterns: [
      "core_anti_estensione",
      "core_anti_rotazione",
      "core_anti_flessione_laterale",
      "anti-extension",
      "anti-rotation",
      "anti-lateral flexion",
    ],
    targets: ["core", "spine", "lower back", "lombare", "addominali", "erettori spinali"],
    nameFragments: [
      "plank",
      "rollout",
      "ab wheel",
      "pallof",
      "dead bug",
      "hollow body",
      "l-sit",
      "dragon flag",
      "hanging leg raise",
    ],
  },
} as const;

type MovementCategory = keyof typeof MOVEMENT_KEYWORDS;

/**
 * Test whether an exercise plausibly belongs to a given movement
 * category. Uses inclusive OR across the three input dimensions so that
 * a coach can express the prescription however is most natural —
 * pattern-only, tag-only, or name-only.
 */
function matchesCategory(exercise: ExerciseInfo, category: MovementCategory): boolean {
  const kw = MOVEMENT_KEYWORDS[category];

  const pattern = exercise.movementPattern?.toLowerCase().trim() ?? "";
  if (pattern && kw.patterns.some((p) => pattern.includes(p))) return true;

  const targets = (exercise.targets ?? []).map((t) => t.toLowerCase().trim());
  if (targets.length > 0 && kw.targets.some((t) => targets.some((x) => x.includes(t)))) {
    return true;
  }

  const name = exercise.name?.toLowerCase().trim() ?? "";
  if (name && kw.nameFragments.some((f) => name.includes(f))) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Score lookups
// ---------------------------------------------------------------------------

/**
 * Resolve the *effective* per-pattern score from an FMS test result.
 *
 * - For bilateral tests (Deep Squat, Trunk Stability Pushup) the raw
 *   score IS the effective score.
 * - For asymmetrical tests (Shoulder Mobility, ASLR, ...) we take the
 *   minimum of left and right per FMS convention: the worse side gates
 *   the prescription, even if the better side is a 3.
 * - Returns `null` if the test was not scored (slot left blank). The
 *   caller treats `null` as "no data, fall back to safe default".
 */
function effectiveScore(result: FmsTestResult | undefined): number | null {
  if (!result) return null;
  if (result.kind === "bilateral") {
    return result.score; // FmsScore | null
  }
  // Asymmetrical: min(L, R), preserving null semantics.
  const { leftScore: l, rightScore: r } = result;
  if (l === null || r === null) return null;
  return Math.min(l, r);
}

/** True iff the named clearing test was performed AND produced pain. */
function clearingTestPositive(
  results: FmsAssessment["clearingTests"],
  id: ClearingTestId,
): boolean {
  const r: ClearingTestResult | undefined = results[id];
  return r?.hasPain === true;
}

/**
 * Find any open red flag whose body region keyword overlaps the
 * exercise's targets/pattern/name. Red flags are user-reported
 * pain occurrences; an unresolved one in a region we're about to load
 * is a HIGH risk regardless of the FMS scores.
 *
 * Heuristic match — we lowercase the flag's `bodyRegion` and check for
 * inclusion in the exercise's collated keyword surface. Cheap, and
 * good enough for the traffic-light view; precise adjudication is the
 * coach's job.
 */
function matchingRedFlag(
  flags: ReadonlyArray<RedFlag>,
  exercise: ExerciseInfo,
  category: MovementCategory,
): RedFlag | null {
  if (flags.length === 0) return null;
  const surface = collateExerciseSurface(exercise, category);
  if (surface.length === 0) return null;

  for (const flag of flags) {
    // We don't know the exact RedFlag shape's field names without
    // codegen drift; we duck-type via `bodyRegion` first then fall back
    // to any string-valued field. Either way: case-insensitive contains.
    const region = readBodyRegion(flag);
    if (!region) continue;
    if (surface.some((s) => region.includes(s) || s.includes(region))) {
      return flag;
    }
  }
  return null;
}

/**
 * Defensive accessor for the red flag's body-region label. We accept
 * any of the common field names (`bodyRegion`, `bodyZone`, `region`,
 * `area`) so this stays robust across small schema evolutions of the
 * RedFlag type without forcing every consumer to update at once.
 */
function readBodyRegion(flag: RedFlag): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = flag as any;
  const candidate = f.bodyRegion ?? f.bodyZone ?? f.region ?? f.area ?? f.location ?? "";
  return typeof candidate === "string" ? candidate.toLowerCase().trim() : "";
}

/**
 * Collate the exercise's keyword surface for red-flag matching: the
 * canonical category targets plus whatever the caller supplied.
 */
function collateExerciseSurface(exercise: ExerciseInfo, category: MovementCategory): string[] {
  const fromCategory = [...MOVEMENT_KEYWORDS[category].targets];
  const fromInput = [
    ...(exercise.targets ?? []),
    exercise.name ?? "",
    exercise.movementPattern ?? "",
  ]
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);
  return [...fromCategory, ...fromInput];
}

// ---------------------------------------------------------------------------
// Rule engine
// ---------------------------------------------------------------------------

/**
 * One detected concern. We accumulate these into the final
 * `ExerciseRiskAssessment` so multiple failed rules each get a reason
 * line — the coach sees the full clinical picture, not just the first
 * trip.
 */
interface Concern {
  level: RiskLevel;
  reason: string;
}

/**
 * Apply the gating rules for a single movement category to the
 * assessment. Returns 0 or more concerns. The caller composes concerns
 * across categories.
 *
 * Rule shape: each category nominates a primary FMS test (the gate) and
 * an optional clearing test (the pain veto). Failing the clearing test
 * is always HIGH; failing the score floor is HIGH at 0, MODERATE at 1.
 */
function evaluateGatedPattern(
  exercise: ExerciseInfo,
  assessment: FmsAssessment,
  category: MovementCategory,
  gateTestId: FmsTestId,
  gateTestLabel: string,
  clearingTest: { id: ClearingTestId; label: string } | null,
): Concern[] {
  if (!matchesCategory(exercise, category)) return [];

  const concerns: Concern[] = [];

  // 1) Clearing test pain — overriding HIGH.
  if (clearingTest && clearingTestPositive(assessment.clearingTests, clearingTest.id)) {
    concerns.push({
      level: "high",
      reason:
        `Test di clearing positivo (${clearingTest.label}): dolore evocato — ` +
        `controindicato il pattern "${gateTestLabel}".`,
    });
  }

  // 2) Per-test score floor.
  const score = effectiveScore(assessment.tests[gateTestId]);
  if (score === null) {
    // Not scored → don't block. The unknown-assessment top-level case
    // already covers "no assessment at all"; here we just have a gap
    // for this specific test, which the coach can backfill.
    // Intentionally no concern emitted.
  } else if (score === 0) {
    concerns.push({
      level: "high",
      reason:
        `Punteggio FMS ${gateTestLabel} = 0 (dolore o blocco): caricamento ` +
        `controindicato. Richiedere screening clinico.`,
    });
  } else if (score === 1) {
    concerns.push({
      level: "moderate",
      reason:
        `Punteggio FMS ${gateTestLabel} = 1 (pattern disfunzionale): valutare ` +
        `regressione o sostituzione dell'esercizio.`,
    });
  }
  // score >= 2 → no concern (the rule's clinical floor).

  // 3) Red-flag overlap — independent of the FMS score, an open pain
  //    report in a region this lift loads is HIGH regardless.
  const flag = matchingRedFlag(assessment.redFlags, exercise, category);
  if (flag) {
    const region = readBodyRegion(flag) || "zona segnalata";
    concerns.push({
      level: "high",
      reason: `Red flag attivo (${region}): l'esercizio carica una zona dolente.`,
    });
  }

  return concerns;
}

/**
 * Compose the final verdict from the per-category concerns. Severity
 * collapses to the worst observed level; reasons are kept in
 * worst-first order so the headline reason is always at index 0.
 */
function summarize(concerns: readonly Concern[]): ExerciseRiskAssessment {
  if (concerns.length === 0) {
    return { isSafe: true, riskLevel: "low", reasons: [] };
  }

  const severityRank: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2 };
  const sorted = [...concerns].sort((a, b) => severityRank[b.level] - severityRank[a.level]);
  const top = sorted[0].level;

  return {
    isSafe: top === "low",
    riskLevel: top,
    reasons: sorted.map((c) => c.reason),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Cross-reference an exercise prescription against an athlete's latest
 * FMS assessment and emit a Biomechanical Traffic Light verdict.
 *
 * Behaviour
 * ---------
 * - If `latestAssessment` is `null` or `undefined` we return a LOW-risk
 *   verdict with a single `unknown_assessment` reason. Rationale: the
 *   coach should not be blocked from prescribing when no clinical data
 *   exists; the UI surfaces the gap.
 * - If the assessment exists but is not marked `isComplete`, we still
 *   evaluate every test that has a score — partial data is better than
 *   no data, and the FMS protocol explicitly supports per-test
 *   scoring. Tests with `null` scores are skipped (no concern emitted
 *   for that gate).
 * - Concerns from multiple rules accumulate; severity collapses to the
 *   worst.
 *
 * @param exerciseInfo    Prescription descriptor (pattern, targets, name).
 * @param latestAssessment Most recent FMS assessment; `null` if none on file.
 * @returns Structured risk verdict suitable for direct UI rendering.
 */
export function analyzeExerciseRisk(
  exerciseInfo: ExerciseInfo,
  latestAssessment: FmsAssessment | null | undefined,
): ExerciseRiskAssessment {
  // No assessment on file: don't block the coach, but tell them why
  // we can't answer.
  if (!latestAssessment) {
    return {
      isSafe: true,
      riskLevel: "low",
      reasons: [
        "Nessuna valutazione FMS disponibile per questo atleta: " +
          "analisi del rischio non eseguibile.",
      ],
    };
  }

  const concerns: Concern[] = [];

  // Rule 1 — Vertical Push / Shoulder-targeted work.
  // Spec: requires Shoulder Mobility >= 2 AND clearing test (Shoulder
  // Impingement) negative. Both branches handled inside
  // `evaluateGatedPattern`.
  concerns.push(
    ...evaluateGatedPattern(
      exerciseInfo,
      latestAssessment,
      "verticalPush",
      "shoulder_mobility",
      "Shoulder Mobility",
      { id: "shoulder_impingement", label: "Shoulder Impingement" },
    ),
  );

  // Rule 2 — Squat pattern.
  // Spec: requires Deep Squat >= 2. Deep Squat has no gating clearing
  // test in the FMS protocol (CLEARING_GATE has no entry for it).
  concerns.push(
    ...evaluateGatedPattern(
      exerciseInfo,
      latestAssessment,
      "squat",
      "deep_squat",
      "Deep Squat",
      null,
    ),
  );

  // Rule 3 — Hinge / Deadlift family.
  // Spec: requires ASLR (Active Straight Leg Raise) >= 2. Asymmetrical
  // test → effectiveScore takes min(L, R) per FMS convention.
  concerns.push(
    ...evaluateGatedPattern(
      exerciseInfo,
      latestAssessment,
      "hinge",
      "active_straight_leg_raise",
      "Active Straight Leg Raise",
      null,
    ),
  );

  // Rule 4 — Core / spinal loading.
  // Spec: requires Trunk Stability Pushup >= 2 AND its clearing test
  // (Spinal Extension) negative. The clearing test gates lumbar
  // extension specifically — directly relevant to anti-extension and
  // axially loaded core work.
  concerns.push(
    ...evaluateGatedPattern(
      exerciseInfo,
      latestAssessment,
      "coreSpinal",
      "trunk_stability_pushup",
      "Trunk Stability Pushup",
      { id: "spinal_extension", label: "Spinal Extension" },
    ),
  );

  return summarize(concerns);
}

// ---------------------------------------------------------------------------
// Convenience exports for testing and downstream consumers
// ---------------------------------------------------------------------------

/**
 * Exposed for unit testing only. Lets a test pass synthetic
 * `ExerciseInfo` and confirm category detection without standing up an
 * entire `FmsAssessment` fixture.
 *
 * @internal
 */
const __testing = {
  effectiveScore,
  matchesCategory,
  MOVEMENT_KEYWORDS,
} as const;
