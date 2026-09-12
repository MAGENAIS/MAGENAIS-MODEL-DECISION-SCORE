/**
 * Unit tests for the standalone DecisionScore package. This is the same
 * test suite as MAGENAIS's tests/unit/decisionScore.test.ts (only the
 * import paths differ) — kept in sync deliberately, since this package's
 * src/ is the source of truth per MASTER PROMPT §28 and MAGENAIS's copy
 * exists only until it is replaced by a dependency on this published
 * package (see ../DECISIONSCORE-REPO-READY.md).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInput,
  DecisionScoreValidationError,
  scoreAndRank,
} from '../src/DecisionScoreAlgorithm.ts';
import { computeDSI, computeDFP } from '../src/DecisionStability.ts';
import { DecisionScoreModel } from '../src/DecisionScoreModel.ts';
import type { DecisionScoreInput } from '../src/types.ts';

/**
 * 3 options / 4 criteria fixture with a deliberately clear winner: option
 * "b" dominates or ties on every maximize criterion and beats the others on
 * the minimize criterion, so the expected top rank is unambiguous.
 */
function threeByFourFixture(): DecisionScoreInput {
  return {
    options: [
      { id: 'a', name: 'Option A' },
      { id: 'b', name: 'Option B' },
      { id: 'c', name: 'Option C' },
    ],
    criteria: [
      { id: 'quality', name: 'Quality', weight: 3, direction: 'maximize' },
      { id: 'speed', name: 'Speed', weight: 2, direction: 'maximize' },
      { id: 'features', name: 'Features', weight: 2, direction: 'maximize' },
      { id: 'cost', name: 'Cost', weight: 1, direction: 'minimize' },
    ],
    scores: {
      a: { quality: 6, speed: 7, features: 5, cost: 40 },
      b: { quality: 9, speed: 8, features: 9, cost: 50 },
      c: { quality: 4, speed: 5, features: 6, cost: 20 },
    },
  };
}

describe('DecisionScoreAlgorithm — validation', () => {
  test('rejects empty options', () => {
    const input = { ...threeByFourFixture(), options: [] };
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('rejects empty criteria', () => {
    const input = { ...threeByFourFixture(), criteria: [] };
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('rejects completely empty input object', () => {
    // @ts-expect-error — deliberately malformed for the test
    assert.throws(() => validateInput({}), DecisionScoreValidationError);
  });

  test('rejects invalid direction', () => {
    const input = threeByFourFixture();
    // @ts-expect-error — deliberately invalid for the test
    input.criteria[0].direction = 'sideways';
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('rejects negative weight', () => {
    const input = threeByFourFixture();
    input.criteria[0].weight = -1;
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('rejects all-zero weights', () => {
    const input = threeByFourFixture();
    for (const c of input.criteria) c.weight = 0;
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('rejects duplicate option ids', () => {
    const input = threeByFourFixture();
    input.options[1].id = 'a';
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('rejects missing score values', () => {
    const input = threeByFourFixture();
    delete (input.scores.b as Record<string, number>).cost;
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('rejects non-numeric score values', () => {
    const input = threeByFourFixture();
    // @ts-expect-error — deliberately invalid for the test
    input.scores.b.cost = 'fifty';
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('rejects a missing score row entirely (single-row-style gap)', () => {
    const input = threeByFourFixture();
    // @ts-expect-error — deliberately invalid for the test
    delete input.scores.c;
    assert.throws(() => validateInput(input), DecisionScoreValidationError);
  });

  test('accepts a valid single-option, single-criterion input (minimal valid case)', () => {
    const input: DecisionScoreInput = {
      options: [{ id: 'only' }],
      criteria: [{ id: 'c1', weight: 1, direction: 'maximize' }],
      scores: { only: { c1: 10 } },
    };
    assert.doesNotThrow(() => validateInput(input));
  });
});

describe('DecisionScoreAlgorithm — known ranking', () => {
  test('3 options / 4 criteria: known weights produce the known expected ranking', () => {
    const input = threeByFourFixture();
    const { ranking } = scoreAndRank(input);
    assert.equal(ranking.length, 3);
    assert.equal(ranking[0].optionId, 'b');
    assert.equal(ranking[0].rank, 1);
    assert.equal(ranking[2].rank, 3);
    // Every normalized score must land in [0, 1].
    for (const entry of ranking) {
      assert.ok(entry.score >= 0 && entry.score <= 1);
    }
  });

  test('single-row data: one option always ranks first with score 1', () => {
    const input: DecisionScoreInput = {
      options: [{ id: 'only' }],
      criteria: [
        { id: 'c1', weight: 1, direction: 'maximize' },
        { id: 'c2', weight: 1, direction: 'minimize' },
      ],
      scores: { only: { c1: 5, c2: 5 } },
    };
    const { ranking } = scoreAndRank(input);
    assert.equal(ranking.length, 1);
    assert.equal(ranking[0].rank, 1);
    assert.equal(ranking[0].score, 1);
  });

  test('small dataset (2 options, 1 criterion) ranks the higher score first', () => {
    const input: DecisionScoreInput = {
      options: [{ id: 'x' }, { id: 'y' }],
      criteria: [{ id: 'c1', weight: 1, direction: 'maximize' }],
      scores: { x: { c1: 1 }, y: { c1: 9 } },
    };
    const { ranking } = scoreAndRank(input);
    assert.equal(ranking[0].optionId, 'y');
    assert.equal(ranking[1].optionId, 'x');
  });

  test('a constant (non-discriminating) criterion is reported and does not throw', () => {
    const input = threeByFourFixture();
    input.scores.a.speed = 7;
    input.scores.b.speed = 7;
    input.scores.c.speed = 7;
    const { constantCriteria } = scoreAndRank(input);
    assert.deepEqual(constantCriteria, ['speed']);
  });

  test('larger synthetic dataset (25 options, 6 criteria) produces a complete, valid ranking', () => {
    const criteria = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      weight: i + 1,
      direction: (i % 2 === 0 ? 'maximize' : 'minimize') as const,
    }));
    // Deterministic pseudo-random-looking but reproducible scores (no RNG — a fixed formula).
    const options = Array.from({ length: 25 }, (_, i) => ({ id: `opt${i}` }));
    const scores: DecisionScoreInput['scores'] = {};
    for (const option of options) {
      const n = Number(option.id.replace('opt', ''));
      scores[option.id] = {};
      for (const c of criteria) {
        const k = Number(c.id.replace('c', ''));
        scores[option.id][c.id] = ((n * 7 + k * 13) % 97) + 1;
      }
    }
    const input: DecisionScoreInput = { options, criteria, scores };
    const { ranking } = scoreAndRank(input);
    assert.equal(ranking.length, 25);
    const ranks = ranking.map((r) => r.rank).sort((a, b) => a - b);
    assert.deepEqual(ranks, Array.from({ length: 25 }, (_, i) => i + 1));
  });
});

describe('Decision Stability Index (DSI)', () => {
  test('a landslide winner has a high DSI under moderate perturbation', () => {
    const input = threeByFourFixture();
    const { dsi, trials } = computeDSI(input, 'b', { trials: 300, magnitude: 0.15, seed: 1 });
    assert.equal(trials, 300);
    assert.ok(dsi > 0.5, `expected a dominant winner to have DSI > 0.5, got ${dsi}`);
    assert.ok(dsi <= 1);
  });

  test('is deterministic for a fixed seed', () => {
    const input = threeByFourFixture();
    const run1 = computeDSI(input, 'b', { trials: 150, magnitude: 0.3, seed: 7 });
    const run2 = computeDSI(input, 'b', { trials: 150, magnitude: 0.3, seed: 7 });
    assert.equal(run1.dsi, run2.dsi);
  });

  test('a single option always has DSI 1', () => {
    const input: DecisionScoreInput = {
      options: [{ id: 'only' }],
      criteria: [{ id: 'c1', weight: 1, direction: 'maximize' }],
      scores: { only: { c1: 1 } },
    };
    const { dsi } = computeDSI(input, 'only');
    assert.equal(dsi, 1);
  });
});

describe('Decision Flip Point (DFP)', () => {
  test('a near-tied pair has a small, findable flip point on the deciding criterion', () => {
    const input: DecisionScoreInput = {
      options: [{ id: 'p' }, { id: 'q' }],
      criteria: [
        { id: 'c1', weight: 1, direction: 'maximize' },
        { id: 'c2', weight: 1, direction: 'maximize' },
      ],
      scores: {
        p: { c1: 10, c2: 1 },
        q: { c1: 1, c2: 10 },
      },
    };
    const dfp = computeDFP(input, 'p', { maxRange: 5, step: 0.01 });
    assert.equal(dfp.length, 2);
    const found = dfp.find((f) => f.relativeChange !== null);
    assert.ok(found, 'expected at least one criterion to flip the near-tied pair within range');
    assert.ok((found!.relativeChange as number) > 0);
    assert.equal(found!.challengerOptionId, 'q');
  });

  test('a landslide winner may have no flip point within a small search range', () => {
    const input = threeByFourFixture();
    const dfp = computeDFP(input, 'b', { maxRange: 0.05, step: 0.01 });
    assert.equal(dfp.length, 4);
    // Every entry is a well-formed DecisionFlipPoint whether or not a flip was found.
    for (const entry of dfp) {
      assert.ok(typeof entry.criterionId === 'string');
      assert.ok(entry.relativeChange === null || entry.relativeChange > 0);
    }
  });

  test('a single option has no flip point for any criterion', () => {
    const input: DecisionScoreInput = {
      options: [{ id: 'only' }],
      criteria: [{ id: 'c1', weight: 1, direction: 'maximize' }],
      scores: { only: { c1: 1 } },
    };
    const dfp = computeDFP(input, 'only');
    assert.equal(dfp.length, 1);
    assert.equal(dfp[0].relativeChange, null);
    assert.equal(dfp[0].challengerOptionId, null);
  });
});

describe('DecisionScoreModel — Model interface', () => {
  test('manifest matches the Model/ModelManifest contract', () => {
    const model = new DecisionScoreModel();
    assert.equal(model.manifest.id, 'magenais.decision-score');
    assert.equal(model.manifest.trust, 'experimental');
    assert.ok(model.manifest.runtimes.includes('builtin-local'));
    assert.ok(model.manifest.capabilities.includes('decision-ranking'));
  });

  test('execute() returns a normalized, successful ModelResponse for valid input', async () => {
    const model = new DecisionScoreModel();
    const response = await model.execute({ input: threeByFourFixture() });
    assert.equal(response.success, true);
    assert.equal(response.modelId, 'magenais.decision-score');
    assert.equal(response.output.topOptionId, 'b');
    assert.ok(response.explanation && response.explanation.includes('sensitivity estimate'));
    assert.ok(response.warnings && response.warnings.length > 0);
    assert.equal(response.metadata?.datasetSize, 3);
    assert.equal(response.metadata?.algorithm, 'normalized-weighted-sum');
  });

  test('execute() throws DecisionScoreValidationError (not a rejected success:false) on invalid input', async () => {
    const model = new DecisionScoreModel();
    await assert.rejects(
      () => model.execute({ input: { options: [], criteria: [], scores: {} } }),
      DecisionScoreValidationError
    );
  });

  test('execute() rejects empty input the same way as a direct validateInput() call', async () => {
    const model = new DecisionScoreModel();
    // @ts-expect-error — deliberately malformed for the test
    await assert.rejects(() => model.execute({ input: {} }), DecisionScoreValidationError);
  });

  test('execute() is deterministic for a fixed seed', async () => {
    const model = new DecisionScoreModel();
    const input = threeByFourFixture();
    const r1 = await model.execute({ input, options: { seed: 5, perturbationTrials: 100 } });
    const r2 = await model.execute({ input, options: { seed: 5, perturbationTrials: 100 } });
    assert.equal(r1.output.dsi, r2.output.dsi);
    assert.deepEqual(r1.output.ranking, r2.output.ranking);
  });
});
