/**
 * DecisionScoreModel.ts
 *
 * Same implementation as MAGENAIS's src/models/decision-score/DecisionScoreModel.ts,
 * adapted only to import the Model/ModelManifest/ModelRequest/ModelResponse
 * shapes from this package's own ./contract.ts instead of MAGENAIS's
 * internal src/models/types/ — everything else is identical on purpose, so
 * MAGENAIS's adapter layer can wrap this package's DecisionScoreModel
 * without reimplementing any logic (MASTER PROMPT §28).
 */

import type { Model, ModelManifest, ModelRequest, ModelResponse } from './contract.ts';
import { validateInput, scoreAndRank } from './DecisionScoreAlgorithm.ts';
import { computeDSI, computeDFP, SENSITIVITY_DISCLAIMER } from './DecisionStability.ts';
import type { DecisionScoreInput, DecisionScoreOutput, DecisionScoreRunOptions } from './types.ts';

export const DECISION_SCORE_MANIFEST: ModelManifest = {
  id: 'magenais.decision-score',
  name: 'DecisionScore',
  version: '1.0.0',
  description:
    'Explainable multi-criteria decision intelligence: ranks options against weighted criteria and reports ' +
    'how stable that ranking is (Decision Stability Index) and how much a weight would need to change to ' +
    'flip it (Decision Flip Point).',
  author: { name: 'MAGENAIS', organization: 'MAGENAIS' },
  type: 'algorithm',
  capabilities: ['decision-ranking', 'sensitivity-analysis'],
  runtimes: ['builtin-local'],
  license: { type: 'Apache-2.0' },
  pricing: { type: 'free' },
  trust: 'experimental',
  uri: 'magenais://decision-score@1.0.0',
  repository: 'MAGENAIS-MODEL-DECISION-SCORE',
};

function buildExplanation(output: DecisionScoreOutput, constantCriteria: string[]): string {
  const top = output.ranking.find((r) => r.rank === 1);
  const lines: string[] = [];

  if (top) {
    lines.push(
      `"${top.name ?? top.optionId}" ranks first with a normalized weighted score of ${top.score.toFixed(3)} (of 1.0).`
    );
  }
  lines.push(
    `Decision Stability Index (DSI): ${output.dsi.toFixed(2)} — the top choice remained unchanged in ` +
      `${Math.round(output.dsi * 100)}% of tested weight perturbations.`
  );

  const mostSensitive = output.dfp.find((f) => f.relativeChange !== null);
  if (mostSensitive) {
    lines.push(
      `Most sensitive criterion: "${mostSensitive.criterionName ?? mostSensitive.criterionId}" — a ` +
        `${(mostSensitive.relativeChange as number) * 100}% ${mostSensitive.direction} in its weight would ` +
        `flip the top choice to "${mostSensitive.challengerOptionId}".`
    );
  } else if (output.dfp.length > 0) {
    lines.push('No tested weight change flipped the top choice within the search range.');
  }

  if (constantCriteria.length > 0) {
    lines.push(
      `Note: criteria [${constantCriteria.join(', ')}] have identical scores across all options and did not ` +
        'discriminate between them.'
    );
  }

  lines.push(SENSITIVITY_DISCLAIMER);
  return lines.join(' ');
}

export class DecisionScoreModel implements Model<DecisionScoreInput, DecisionScoreOutput> {
  readonly manifest: ModelManifest = DECISION_SCORE_MANIFEST;

  async execute(
    request: ModelRequest<DecisionScoreInput>
  ): Promise<ModelResponse<DecisionScoreOutput>> {
    const input = request.input;
    validateInput(input);

    const runOptions = (request.options ?? {}) as DecisionScoreRunOptions;

    const { ranking, constantCriteria } = scoreAndRank(input);
    const topOptionId = ranking[0]?.optionId ?? null;

    const { dsi, trials } = topOptionId
      ? computeDSI(input, topOptionId, {
          trials: runOptions.perturbationTrials,
          magnitude: runOptions.perturbationMagnitude,
          seed: runOptions.seed,
        })
      : { dsi: 1, trials: 0 };

    const dfp = topOptionId
      ? computeDFP(input, topOptionId, {
          maxRange: runOptions.maxFlipSearchRange,
          step: runOptions.flipSearchStep,
        })
      : [];

    const output: DecisionScoreOutput = { ranking, topOptionId, dsi, dfp };

    const warnings: string[] = [SENSITIVITY_DISCLAIMER];
    if (constantCriteria.length > 0) {
      warnings.push(`Non-discriminating criteria (identical scores across all options): ${constantCriteria.join(', ')}`);
    }
    if (input.options.length === 1) {
      warnings.push('Only one option was provided — DSI and DFP are trivially 1 / null.');
    }

    return {
      success: true,
      modelId: this.manifest.id,
      modelVersion: this.manifest.version,
      output,
      confidence: dsi,
      evidence: { perturbationTrials: trials },
      explanation: buildExplanation(output, constantCriteria),
      warnings,
      metadata: {
        datasetSize: input.options.length,
        algorithm: 'normalized-weighted-sum',
      },
    };
  }
}
