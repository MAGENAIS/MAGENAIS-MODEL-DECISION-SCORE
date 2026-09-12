// Runnable example — no MAGENAIS installation required.
//
// Usage:
//   node --experimental-strip-types examples/basic-usage.mjs
// (or: npm run example)

import { DecisionScoreModel } from '../src/index.ts';

const model = new DecisionScoreModel();

const response = await model.execute({
  input: {
    options: [
      { id: 'vendor-a', name: 'Vendor A' },
      { id: 'vendor-b', name: 'Vendor B' },
      { id: 'vendor-c', name: 'Vendor C' },
    ],
    criteria: [
      { id: 'price', name: 'Price', weight: 2, direction: 'minimize' },
      { id: 'quality', name: 'Quality', weight: 3, direction: 'maximize' },
      { id: 'support', name: 'Support', weight: 1, direction: 'maximize' },
    ],
    scores: {
      'vendor-a': { price: 8000, quality: 7, support: 6 },
      'vendor-b': { price: 9500, quality: 9, support: 8 },
      'vendor-c': { price: 7000, quality: 6, support: 5 },
    },
  },
  options: {
    // Fixed seed => reproducible DSI across runs.
    seed: 42,
    perturbationTrials: 200,
  },
});

console.log('Ranking:');
for (const entry of response.output.ranking) {
  console.log(`  ${entry.rank}. ${entry.name ?? entry.optionId} — score ${entry.score.toFixed(3)}`);
}

console.log(`\nDecision Stability Index (DSI): ${response.output.dsi.toFixed(2)}`);

console.log('\nDecision Flip Points:');
for (const flip of response.output.dfp) {
  const label = flip.criterionName ?? flip.criterionId;
  if (flip.relativeChange === null) {
    console.log(`  ${label}: no flip found within the tested range`);
  } else {
    console.log(
      `  ${label}: a ${(flip.relativeChange * 100).toFixed(1)}% ${flip.direction} would flip the top choice to "${flip.challengerOptionId}"`
    );
  }
}

console.log(`\n${response.explanation}`);
