/**
 * types.ts (DecisionScore)
 *
 * Input/output shapes specific to the DecisionScore model. These are
 * distinct from the generic ModelRequest<T>/ModelResponse<T> envelopes in
 * ../types/ — DecisionScoreInput is the `T` that fills ModelRequest.input,
 * and DecisionScoreOutput is the `T` that fills ModelResponse.output.
 *
 * Per MASTER PROMPT §8: explainable multi-criteria decision intelligence.
 */

export type DecisionScoreDirection = 'maximize' | 'minimize';

export interface DecisionScoreOption {
  id: string;
  name?: string;
}

export interface DecisionScoreCriterion {
  id: string;
  name?: string;
  /** Relative importance. Need not sum to 1 across criteria — normalized internally. Must be >= 0. */
  weight: number;
  direction: DecisionScoreDirection;
}

/** scores[optionId][criterionId] = the raw numeric score of that option under that criterion. */
export type DecisionScoreMatrix = Record<string, Record<string, number>>;

export interface DecisionScoreInput {
  options: DecisionScoreOption[];
  criteria: DecisionScoreCriterion[];
  scores: DecisionScoreMatrix;
  /**
   * Free-form notes about constraints on the decision (e.g. "budget <= 10000").
   * V4.1 does not evaluate constraints numerically — they are carried through
   * for display/explanation only, per the master prompt's "constraints" input
   * field with no specified enforcement algorithm.
   */
  constraints?: string[];
}

export interface DecisionScoreRunOptions {
  /** Number of perturbation trials used for the Decision Stability Index. Default 200. */
  perturbationTrials?: number;
  /** Max relative perturbation applied to a criterion's weight during DSI trials, e.g. 0.2 = ±20%. Default 0.2. */
  perturbationMagnitude?: number;
  /**
   * Deterministic seed for DSI's perturbation sampling. Same input + same
   * seed always yields the same DSI (MASTER PROMPT §37: "deterministic
   * output"). Default 42.
   */
  seed?: number;
  /** Largest relative weight change tested per criterion when searching for a Decision Flip Point. Default 5 (500%). */
  maxFlipSearchRange?: number;
  /** Step size used while sweeping for a Decision Flip Point. Default 0.05 (5%). */
  flipSearchStep?: number;
}

export interface DecisionScoreRankEntry {
  optionId: string;
  name?: string;
  /** Normalized weighted score in [0, 1]. Higher is better regardless of each criterion's own direction. */
  score: number;
  rank: number;
}

export interface DecisionFlipPoint {
  criterionId: string;
  criterionName?: string;
  /** Whether the tested change increases or decreases this criterion's weight. */
  direction: 'increase' | 'decrease';
  /** Relative change (0.15 = 15%) at which the top-ranked option changes, within the tested range. Null if no flip was found in range. */
  relativeChange: number | null;
  /** The option that would take over first place at relativeChange, if found. */
  challengerOptionId: string | null;
}

export interface DecisionScoreOutput {
  ranking: DecisionScoreRankEntry[];
  topOptionId: string | null;
  /** Decision Stability Index (MASTER PROMPT §8): proportion of tested perturbations where the top choice was unchanged. */
  dsi: number;
  /** Decision Flip Point(s) (MASTER PROMPT §8), one per criterion, sorted by ascending sensitivity (most sensitive first). */
  dfp: DecisionFlipPoint[];
}
